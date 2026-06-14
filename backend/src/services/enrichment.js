// Enrichment service: determines which representatives are relevant for each project/bill
// and stores them as a JSON array in `relevant_reps`.
//
// Projects: rule-based (we already know the district and funding type, no tokens needed).
// Bills:    LLM-based via Claude Haiku — the connection to specific SF reps is less obvious
//           from the bill title alone, so we let Claude reason about it.
//
// Both paths skip records that already have llm_enriched_at set, so re-running is a no-op
// unless the source data changed (content_hash mismatch clears llm_enriched_at).

import Anthropic from '@anthropic-ai/sdk';
import db from '../db/index.js';
import { SF_SUPERVISORS, SF_STATE_REPS, SF_FEDERAL_REPS } from '../db/constants.js';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Runs after each scrape cycle. Enriches all unenriched projects and bills in one pass.
export async function enrichUnenriched() {
  enrichProjects();            // synchronous, rule-based
  await enrichBills();         // async, LLM-based
}

// ─── Projects ────────────────────────────────────────────────────────────────

// Assigns relevant_reps to every project that doesn't have them yet.
// Rule-based: district → supervisor, mayor, state assembly/senate always included;
// federal reps added when the project uses federal funding or has ≥100 units.
function enrichProjects() {
  const rows = db.prepare('SELECT id, district, lead_agency, units_affordable, source FROM projects WHERE llm_enriched_at IS NULL').all();
  const stmt = db.prepare(`UPDATE projects SET relevant_reps = ?, llm_enriched_at = datetime('now') WHERE id = ?`);

  for (const project of rows) {
    const reps = buildProjectReps(project);
    stmt.run(JSON.stringify(reps), project.id);
  }
}

function buildProjectReps(project) {
  const reps = [];
  const district = project.district;

  // District Supervisor — always primary contact for local planning decisions
  const sup = SF_SUPERVISORS[district];
  if (sup) {
    reps.push({ name: sup.name, title: `District ${district} Supervisor`, level: 'local', email: sup.email, reason: 'District supervisor votes on local planning approvals' });
  }

  // Mayor — relevant for any project involving city funding or large developments
  reps.push({ name: SF_STATE_REPS.mayor.name, title: SF_STATE_REPS.mayor.title, level: 'local', email: SF_STATE_REPS.mayor.email, reason: 'Mayor oversees city housing policy and MOHCD funding' });

  // State Assembly — always relevant; CA housing law governs approval processes
  const assembly = district <= 5 ? SF_STATE_REPS.assembly.low : SF_STATE_REPS.assembly.high;
  reps.push({ name: assembly.name, title: assembly.title, level: 'state', email: assembly.email, reason: 'State housing law and infrastructure bond funding' });

  // State Senate — Scott Wiener authors most SF-relevant state housing bills
  reps.push({ name: SF_STATE_REPS.senate.name, title: SF_STATE_REPS.senate.title, level: 'state', email: SF_STATE_REPS.senate.email, reason: 'Author of SB 9, SB 10, and other SF housing legislation' });

  // Federal reps — add when HUD/federal agencies are involved or project is large
  const federallyFunded = isFederallyFunded(project);
  if (federallyFunded) {
    reps.push({ name: SF_FEDERAL_REPS.house.name, title: SF_FEDERAL_REPS.house.title, level: 'federal', email: SF_FEDERAL_REPS.house.email, reason: 'Federal HUD appropriations and Section 8 voucher programs' });
    for (const senator of SF_FEDERAL_REPS.senate) {
      reps.push({ name: senator.name, title: senator.title, level: 'federal', contactUrl: senator.contactUrl, reason: 'Federal housing funding legislation' });
    }
  }

  return reps;
}

function isFederallyFunded({ lead_agency = '', units_affordable = 0 }) {
  const agency = lead_agency.toLowerCase();
  return agency.includes('hud') || agency.includes('ocii') || agency.includes('federal') ||
    (units_affordable && units_affordable >= 100);
}

// ─── Bills ───────────────────────────────────────────────────────────────────

// Uses Claude Haiku to analyze each unenriched bill and determine which SF reps
// are most relevant and why. Processes up to 10 bills per run to control costs.
async function enrichBills() {
  const bills = db.prepare('SELECT id, title, status, government_level, state, bill_number FROM bills WHERE llm_enriched_at IS NULL LIMIT 10').all();
  if (!bills.length) return;

  const allReps = buildRepDirectory();

  for (const bill of bills) {
    try {
      const reps = await classifyBillReps(bill, allReps);
      db.prepare(`UPDATE bills SET relevant_reps = ?, llm_enriched_at = datetime('now') WHERE id = ?`)
        .run(JSON.stringify(reps), bill.id);
    } catch (err) {
      console.warn(`[enrichment] Bill ${bill.id} enrichment failed:`, err.message);
    }
  }
}

async function classifyBillReps(bill, allReps) {
  // Only offer reps who can actually influence this level of legislation
  const eligibleReps = bill.government_level === 'federal'
    ? allReps.filter(r => r.level === 'federal')
    : allReps.filter(r => r.level !== 'federal');

  const prompt = `You analyze housing legislation for San Francisco advocates.

Bill: ${bill.bill_number} — ${bill.title}
Level: ${bill.government_level} (${bill.state})
Status: ${bill.status}

Available SF representatives:
${eligibleReps.map((r, i) => `${i + 1}. ${r.name} (${r.title}) — ${r.level}`).join('\n')}

Which 2-4 of these representatives are MOST relevant for a constituent to contact about this bill?
Choose only those who can actually influence this bill's outcome or funding.

Respond with JSON only (no prose):
{
  "description": "one sentence explaining this bill's SF housing impact",
  "relevant_indices": [1, 3]
}`;

  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    messages: [{ role: 'user', content: prompt }],
  });

  let parsed;
  try {
    parsed = JSON.parse(msg.content[0].text);
  } catch {
    return eligibleReps.slice(0, 3);
  }

  // Map selected indices back to rep objects
  const selected = (parsed.relevant_indices || [])
    .map(i => eligibleReps[i - 1])
    .filter(Boolean);

  return selected.length ? selected : eligibleReps.slice(0, 3);
}

// Flat list of all SF reps passed to Claude as a numbered menu
function buildRepDirectory() {
  return [
    { name: SF_STATE_REPS.mayor.name, title: SF_STATE_REPS.mayor.title, level: 'local', email: SF_STATE_REPS.mayor.email },
    { name: SF_STATE_REPS.assembly.low.name, title: SF_STATE_REPS.assembly.low.title, level: 'state', email: SF_STATE_REPS.assembly.low.email },
    { name: SF_STATE_REPS.assembly.high.name, title: SF_STATE_REPS.assembly.high.title, level: 'state', email: SF_STATE_REPS.assembly.high.email },
    { name: SF_STATE_REPS.senate.name, title: SF_STATE_REPS.senate.title, level: 'state', email: SF_STATE_REPS.senate.email },
    { name: SF_FEDERAL_REPS.house.name, title: SF_FEDERAL_REPS.house.title, level: 'federal', email: SF_FEDERAL_REPS.house.email },
    ...SF_FEDERAL_REPS.senate.map(s => ({ name: s.name, title: s.title, level: 'federal', contactUrl: s.contactUrl })),
  ];
}
