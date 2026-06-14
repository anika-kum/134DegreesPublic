// Claude AI service: generates personalized advocacy content for SF housing projects.
// Uses claude-sonnet-4-6 for emails (richer, longer output) and claude-haiku for
// tweets/call scripts (faster and cheaper for short content).

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Generates a full advocacy email personalized to the user's housing situation,
// background, and personal story. targetRep (optional) scopes the salutation and
// ask to a specific official — without it, the email defaults to the district supervisor.
export async function generateAdvocacyEmail({ user, project, tone, targetRep }) {
  const toneInstructions = {
    emotional: 'Write with personal urgency and compassion. Lead with human impact — the real people who will be helped. Use first-person lived experience. Evoke empathy without being melodramatic.',
    'data-driven': 'Lead with statistics and policy context. Reference SF housing shortage numbers, AMI levels, and planning policy. Be precise, cite the specific project details, and make a logical case for approval.',
    formal: 'Use professional, respectful language appropriate for a government official. Structured paragraphs, clear ask in the opening. Respectful of the official\'s role and the public process.',
  };

  const userContext = buildUserContext(user);
  const projectContext = buildProjectContext(project);

  // Build a rep-specific paragraph so the ask matches what this official can actually do
  const repContext = targetRep
    ? `TARGET REPRESENTATIVE: ${targetRep.name} (${targetRep.title})
Role in this project: ${targetRep.reason || 'Relevant official'}
Tailor the salutation and the specific ask to this official's jurisdiction and powers.
${targetRep.level === 'federal' ? 'Federal reps control HUD funding, Section 8 vouchers, and federal housing legislation.' : ''}
${targetRep.level === 'state' ? 'State reps control state housing law, density bonuses, and state bond funding.' : ''}
${targetRep.level === 'local' && targetRep.title?.includes('Supervisor') ? 'The Supervisor votes on Planning Commission approvals and city budget allocations.' : ''}
${targetRep.level === 'local' && targetRep.title?.includes('Mayor') ? 'The Mayor controls MOHCD funding, executive housing policy, and city budget priorities.' : ''}`
    : `TARGET REPRESENTATIVE: ${project.supervisor} (District ${project.district} Supervisor)
Role: Votes on Planning Commission approvals for this project.`;

  const prompt = `You are an expert housing advocacy writer helping San Francisco residents write impactful letters to elected officials about affordable housing.

TONE: ${toneInstructions[tone] || toneInstructions.emotional}

USER PROFILE:
${userContext}

PROJECT DETAILS:
${projectContext}

${repContext}

Write a complete advocacy email. Structure:
1. Subject line (on its own line starting with "Subject: ")
2. Salutation addressed to the TARGET REPRESENTATIVE above
3. Opening paragraph — state who you are (using user context naturally) and why you're writing
4. 2-3 body paragraphs — make the case for the project, connect it to the user's personal context, and frame the ask in terms of what THIS official specifically can do
5. Specific ask — request the action this official has power to take
6. Closing

Keep it under 350 words. Make it feel authentic and personal, not templated. Do NOT use placeholder brackets like [your name] — weave in the actual user details naturally.`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  return message.content[0].text;
}

// Generates a tweet-length (≤260 char) advocacy post for the project.
// Uses Haiku since the output is very short and speed matters for UX.
export async function generateTweet({ project }) {
  const prompt = `Write a compelling tweet (under 260 characters) urging support for this SF affordable housing project.
Project: ${project.title} — ${project.units_affordable} affordable units at ${project.address}.
Include the supervisor's name: ${project.supervisor}.
Hearing date: ${project.hearing_date}.
Use hashtags: #SFHousing #AffordableHousing
Do NOT use emojis. Keep it punchy and direct.`;

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    messages: [{ role: 'user', content: prompt }],
  });
  return message.content[0].text.trim();
}

// Generates a ~30-second phone script for calling the Supervisor's office.
// Leaves [NAME] as a spoken placeholder since the user will say it themselves.
export async function generateCallScript({ user, project }) {
  const prompt = `Write a 30-second phone call script for a constituent calling their SF District Supervisor's office to advocate for an affordable housing project.

Supervisor: ${project.supervisor}
Project: ${project.title}, ${project.units_affordable} affordable units at ${project.address}
User's district: District ${user.district}
Hearing date: ${project.hearing_date}

Format:
- "Hi, my name is [NAME] and I'm a District ${user.district} resident..."
- State the project and case number: ${project.case_number}
- Make the ask: vote yes / support the project
- Thank them

Keep it under 80 words. Conversational, not read-from-paper. Fill in [NAME] as a placeholder the user will say themselves.`;

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    messages: [{ role: 'user', content: prompt }],
  });
  return message.content[0].text.trim();
}

// Builds a plain-text user profile block injected into every Claude prompt.
// Only includes fields the user actually filled in — omitting empty fields
// prevents Claude from inventing details or hedging with "if applicable".
function buildUserContext(user) {
  const parts = [];
  parts.push(`Name: ${user.name}`);
  parts.push(`SF District: ${user.district}`);
  parts.push(`Housing status: ${user.housing_status}`);
  if (user.tenure_years) parts.push(`Has lived in SF for ${user.tenure_years} years`);
  if (user.income_bracket) parts.push(`Income bracket: ${user.income_bracket}`);
  if (user.has_children) parts.push('Has children / dependents');
  if (user.occupation) parts.push(`Occupation: ${user.occupation}`);
  // personal_story is the most impactful field — quoted so Claude treats it as the user's voice
  if (user.personal_story) parts.push(`Personal context: "${user.personal_story}"`);
  const langs = tryParse(user.languages, ['English']);
  if (langs.length > 1) parts.push(`Primary languages: ${langs.join(', ')}`);
  return parts.join('\n');
}

// Builds a structured project fact sheet for Claude to reference when writing.
function buildProjectContext(p) {
  return [
    `Title: ${p.title}`,
    `Address: ${p.address}`,
    `District: ${p.district}`,
    `Type: ${p.type}`,
    `Total units: ${p.units_total} (${p.units_affordable} affordable)`,
    `AMI levels: ${Array.isArray(p.ami_levels) ? p.ami_levels.join(', ') : p.ami_levels}`,
    `Status: ${p.status}`,
    `Planning hearing: ${p.hearing_date}`,
    `Case number: ${p.case_number}`,
    `Lead agency: ${p.lead_agency}`,
    `District Supervisor: ${p.supervisor}`,
    `Description: ${p.description}`,
  ].join('\n');
}

// ─── Bill advocacy ───────────────────────────────────────────────────────────

export async function generateBillEmail({ user, bill, tone, targetRep }) {
  const toneInstructions = {
    emotional: 'Write with personal urgency and compassion. Lead with human impact on real SF residents.',
    'data-driven': 'Lead with policy context and specifics. Reference the bill number, its provisions, and housing data.',
    formal: 'Use professional language appropriate for a government official. Structured paragraphs, clear ask.',
  };

  const repLine = targetRep
    ? `TARGET REPRESENTATIVE: ${targetRep.name} (${targetRep.title})\n${targetRep.level === 'federal' ? 'Ask them to co-sponsor or vote yes on this federal bill.' : 'Ask them to vote yes / champion this state bill.'}`
    : 'Address the email to the most relevant official for this bill.';

  const prompt = `You are a housing advocacy writer helping an SF resident write a letter about a housing bill.

TONE: ${toneInstructions[tone] || toneInstructions.emotional}

USER PROFILE:
${buildUserContext(user)}

BILL:
Number: ${bill.bill_number}
Title: ${bill.title}
Level: ${bill.government_level} (${bill.state})
Status: ${bill.status || 'In committee'}
Description: ${bill.description || bill.title}

${repLine}

Write a complete advocacy email. Structure:
1. Subject line starting with "Subject: "
2. Salutation to the target representative
3. Opening: who you are and why this bill matters to you as an SF resident
4. 2 body paragraphs: what the bill does and why it's critical for SF housing
5. Specific ask tied to what this official can actually do
6. Closing

Under 300 words. Personal and specific, not templated.`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });
  return message.content[0].text;
}

export async function generateBillTweet({ bill }) {
  const prompt = `Write a compelling tweet (under 260 characters) urging support for this housing bill.
Bill: ${bill.bill_number} — ${bill.title}
Level: ${bill.government_level}
Use hashtags: #AffordableHousing #HousingPolicy ${bill.state === 'CA' ? '#CALeg' : '#Congress'}
Do NOT use emojis. Punchy and direct.`;

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    messages: [{ role: 'user', content: prompt }],
  });
  return message.content[0].text.trim();
}

export async function generateBillCallScript({ user, bill, targetRep }) {
  const rep = targetRep ? `${targetRep.name} (${targetRep.title})` : 'your representative';
  const prompt = `Write a 30-second phone script for an SF resident calling to support a housing bill.

Bill: ${bill.bill_number} — ${bill.title}
Representative: ${rep}
User district: District ${user.district}

Format: "Hi, my name is [NAME] and I'm an SF District ${user.district} constituent..."
Make the ask: support / vote yes on ${bill.bill_number}.
Under 80 words. Conversational.`;

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    messages: [{ role: 'user', content: prompt }],
  });
  return message.content[0].text.trim();
}

function tryParse(val, fallback) {
  try { return JSON.parse(val); } catch { return fallback; }
}
