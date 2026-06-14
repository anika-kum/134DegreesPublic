// Housing bill scraper using two purpose-built public APIs:
//   - Congress.gov API  → federal bills (US Congress)
//   - OpenStates API    → California state bills
//
// Both run in parallel. Each fails silently so the other still completes.
// Bills are deduplicated by a prefixed external ID (congress-* / openstates-*)
// stored in the legiscan_bill_id column. content_hash tracks changes so we only
// re-run LLM enrichment when a bill actually updates.
//
// Required env vars:
//   CONGRESS_API_KEY    — free at api.congress.gov/sign-up
//   OPENSTATES_API_KEY  — free at openstates.org/accounts/signup

import axios from 'axios';
import db from '../db/index.js';

const CONGRESS_BASE = 'https://api.congress.gov/v3';
const OPENSTATES_BASE = 'https://v3.openstates.org';

const HOUSING_QUERIES = [
  'affordable housing',
  'rent eviction housing voucher',
  'low income housing AMI',
];

// Congress.gov search is fuzzy and returns procedural bills that mention
// housing only incidentally. Require at least one of these in the title.
const HOUSING_TITLE_KEYWORDS = [
  'housing', 'rent', 'renter', 'tenant', 'eviction', 'affordable',
  'voucher', 'section 8', 'hud', 'homelessness', 'homeless', 'mortgage',
  'foreclosure', 'ami', 'low income', 'low-income', 'public housing',
];

function isHousingRelated(title) {
  const lower = title.toLowerCase();
  return HOUSING_TITLE_KEYWORDS.some(kw => lower.includes(kw));
}

export async function scrapeLegislation() {
  console.log('[legislation] Starting bill scrape...');
  await Promise.allSettled([
    scrapeCongressBills(),
    scrapeOpenStatesBills(),
  ]);
  console.log('[legislation] Done.');
}

// ─── Congress.gov (federal) ───────────────────────────────────────────────────

// Maps Congress.gov bill type codes to the slug used in congress.gov URLs
const CONGRESS_TYPE_SLUG = {
  HR: 'house-bill', S: 'senate-bill',
  HJRES: 'house-joint-resolution', SJRES: 'senate-joint-resolution',
  HCONRES: 'house-concurrent-resolution', SCONRES: 'senate-concurrent-resolution',
  HRES: 'house-resolution', SRES: 'senate-resolution',
};

function congressUrl(bill) {
  const slug = CONGRESS_TYPE_SLUG[bill.type] || `${bill.type.toLowerCase()}-bill`;
  return `https://www.congress.gov/bill/${bill.congress}th-congress/${slug}/${bill.number}`;
}

async function scrapeCongressBills() {
  const key = process.env.CONGRESS_API_KEY;
  if (!key) { console.warn('[legislation] CONGRESS_API_KEY not set — skipping federal bills'); return; }

  for (const query of HOUSING_QUERIES) {
    try {
      const { data } = await axios.get(`${CONGRESS_BASE}/bill`, {
        params: { q: JSON.stringify({ query }), sort: 'updateDate+desc', limit: 15, format: 'json', api_key: key },
        timeout: 15000,
      });

      for (const bill of (data?.bills || [])) {
        if (!isHousingRelated(bill.title)) continue;

        const externalId = `congress-${bill.type}-${bill.number}-${bill.congress}`;
        const hash = `${bill.updateDate}|${bill.latestAction?.text || ''}`;
        const url = congressUrl(bill);

        const existing = db.prepare('SELECT id, content_hash FROM bills WHERE legiscan_bill_id = ?').get(externalId);
        if (existing) {
          if (existing.content_hash !== hash) {
            db.prepare(`UPDATE bills SET content_hash = ?, status = ?, url = ?, llm_enriched_at = NULL,
              last_scraped = datetime('now') WHERE legiscan_bill_id = ?`)
              .run(hash, (bill.latestAction?.text || '').slice(0, 200), url, externalId);
          } else {
            // Always sync the URL so stale wrong URLs get corrected on next scrape
            db.prepare(`UPDATE bills SET url = ?, last_scraped = datetime('now') WHERE legiscan_bill_id = ?`)
              .run(url, externalId);
          }
          continue;
        }

        db.prepare(`
          INSERT OR IGNORE INTO bills
            (legiscan_bill_id, title, status, government_level, bill_number, session, state, url, content_hash)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          externalId,
          String(bill.title || '').slice(0, 300),
          (bill.latestAction?.text || '').slice(0, 200),
          'federal',
          `${bill.type} ${bill.number}`,
          String(bill.congress),
          'US',
          url,
          hash,
        );
      }
    } catch (err) {
      console.warn(`[legislation] Congress.gov "${query}" failed:`, err.message);
    }
  }
}

// ─── OpenStates (California state bills) ─────────────────────────────────────

async function scrapeOpenStatesBills() {
  const key = process.env.OPENSTATES_API_KEY;
  if (!key) { console.warn('[legislation] OPENSTATES_API_KEY not set — skipping state bills'); return; }

  for (const query of HOUSING_QUERIES) {
    try {
      const { data } = await axios.get(`${OPENSTATES_BASE}/bills`, {
        params: { jurisdiction: 'ca', q: query, sort: 'updated_desc', per_page: 15 },
        headers: { 'X-API-KEY': key },
        timeout: 15000,
      });

      for (const bill of (data?.results || [])) {
        const externalId = `openstates-${bill.id}`;
        // Hash on update time + first abstract so enrichment re-runs if the bill text changes
        const hash = `${bill.updated_at}|${bill.abstracts?.[0]?.abstract?.slice(0, 100) || ''}`;

        const existing = db.prepare('SELECT id, content_hash FROM bills WHERE legiscan_bill_id = ?').get(externalId);
        if (existing) {
          if (existing.content_hash !== hash) {
            db.prepare(`UPDATE bills SET content_hash = ?, llm_enriched_at = NULL,
              last_scraped = datetime('now') WHERE legiscan_bill_id = ?`)
              .run(hash, externalId);
          }
          continue;
        }

        const latestAction = bill.actions?.[bill.actions.length - 1]?.description || '';
        const abstract = bill.abstracts?.[0]?.abstract || '';

        db.prepare(`
          INSERT OR IGNORE INTO bills
            (legiscan_bill_id, title, description, status, government_level, bill_number, session, state, url, content_hash)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          externalId,
          String(bill.title || '').slice(0, 300),
          abstract.slice(0, 500),
          latestAction.slice(0, 200),
          'state',
          bill.identifier || '',
          bill.session || '',
          'CA',
          bill.openstates_url || '',
          hash,
        );
      }
    } catch (err) {
      console.warn(`[legislation] OpenStates "${query}" failed:`, err.message);
    }
  }
}
