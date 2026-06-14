// SF Housing Project Scraper
// Pulls live project data from the SF Planning Commission via Legistar/Granicus API.
// Fetches pre-approval agenda items — cases actively before the Planning Commission
// where public advocacy (emails, calls) can influence the outcome.
//
// Fails silently (log + continue) so a downed portal never crashes the server.
// Run on startup and every 6 hours via cron in index.js.

import axios from 'axios';
import db from '../db/index.js';
import { SF_SUPERVISORS } from '../db/constants.js';

const LEGISTAR_BASE = 'https://sfgov.legistar.com';

export async function scrapeAll() {
  console.log('[scraper] Starting SF Planning Commission scrape...');
  await scrapePlanningLegistar();
  console.log('[scraper] Done.');
}

// Fetches the 20 most recent SF Planning Commission meeting agendas via
// the Legistar public JSON API (body ID 3 = SF Planning Commission).
// For each meeting, fetches individual agenda items and filters for housing-related ones.
async function scrapePlanningLegistar() {
  try {
    const { data } = await axios.get(
      `${LEGISTAR_BASE}/gateway.aspx/api/v1/bodies/3/events?token=&$top=20&$orderby=EventDate desc`,
      { timeout: 10000 },
    );

    for (const event of (data || [])) {
      const eventDate = event.EventDate?.split('T')[0];
      if (!eventDate) continue;

      // Fetch agenda items for this meeting; MatterAttachments expanded for future PDF parsing
      const { data: items } = await axios.get(
        `${LEGISTAR_BASE}/gateway.aspx/api/v1/events/${event.EventId}/eventitems?token=&$expand=MatterAttachments`,
        { timeout: 10000 },
      ).catch(() => ({ data: [] }));

      for (const item of (items || [])) {
        const title = item.EventItemMatterName || item.EventItemTitle || '';
        if (!isHousingItem(title)) continue;

        // case_number is UNIQUE in the DB, so this is a fast existence check
        const existing = db.prepare('SELECT id FROM projects WHERE case_number = ?').get(item.EventItemMatterFile);
        if (existing) continue;

        const district = guessDistrict(title + ' ' + (item.EventItemMatterText || ''));
        const supervisor = SF_SUPERVISORS[district] || SF_SUPERVISORS[6];

        db.prepare(`
          INSERT OR IGNORE INTO projects
            (title, address, district, type, status, description, hearing_date,
             portal_url, case_number, lead_agency,
             supervisor, supervisor_email, source, last_scraped)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `).run(
          title.slice(0, 200),
          extractAddress(title) || 'See case file',
          district,
          classifyType(title),
          'Planning Commission Agenda',
          item.EventItemMatterText?.slice(0, 500) || title,
          eventDate,
          `${LEGISTAR_BASE}/MatterDetail.aspx?ID=${item.EventItemMatterId}`,
          item.EventItemMatterFile || `LEGISTAR-${item.EventItemId}`,
          'SF Planning Commission',
          supervisor.name,
          supervisor.email,
          'Legistar',
        );
      }
    }
  } catch (err) {
    console.warn('[scraper] Legistar fetch failed:', err.message);
  }
}

// Returns true if the agenda item title contains housing-related keywords
function isHousingItem(title) {
  const t = title.toLowerCase();
  return ['housing', 'affordable', 'residential', 'dwelling', 'unit', 'ami', 'low-income', 'mixed-income'].some(k => t.includes(k));
}

// Infers project type from title keywords for display and filtering
function classifyType(title) {
  const t = title.toLowerCase();
  if (t.includes('senior')) return 'Senior Affordable';
  if (t.includes('supportive') || t.includes('transitional')) return 'Supportive Housing';
  if (t.includes('100%') || t.includes('all-affordable')) return '100% Affordable';
  if (t.includes('family')) return 'Family Affordable';
  if (t.includes('mixed')) return 'Mixed-Income Affordable';
  return 'Affordable Rental';
}

// Extracts a street address from a Legistar agenda item title using regex
function extractAddress(text) {
  const match = text.match(/\d+\s+[A-Z][a-zA-Z\s]+(Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd|Way|Drive|Dr|Lane|Ln|Court|Ct|Place|Pl)/);
  return match ? match[0] : null;
}

// Maps SF neighborhood keywords to supervisorial district numbers.
// First tries to extract a zip code from the text (most reliable signal), then
// falls back to keyword matching. Falls back to District 6 when nothing matches.
function guessDistrict(text) {
  // Zip code extraction is more reliable than keyword matching for Legistar titles
  const zipMatch = text.match(/\b(941\d{2})\b/);
  if (zipMatch) {
    const d = guessDistrictByZip(zipMatch[1]);
    if (d) return d;
  }

  const t = text.toLowerCase();
  // District 9 — Mission, Bernal, Potrero
  if (t.includes('mission') || t.includes('bernal') || t.includes('potrero') || t.includes('24th st')) return 9;
  // District 10 — Bayview, Hunters Point, Portola, Dogpatch, Visitacion Valley
  if (t.includes('bayview') || t.includes('hunters point') || t.includes('portola') ||
      t.includes('dogpatch') || t.includes('visitacion') || t.includes('silver terrace') ||
      t.includes('3rd street')) return 10;
  // District 11 — Excelsior, Ingleside, Outer Mission, Crocker Amazon
  if (t.includes('excelsior') || t.includes('ingleside') || t.includes('outer mission') ||
      t.includes('crocker amazon') || t.includes('oceanview')) return 11;
  // District 6 — SoMa, Tenderloin, Civic Center, Mid-Market
  if (t.includes('soma') || t.includes('south of market') || t.includes('tenderloin') ||
      t.includes('civic center') || t.includes('mid-market') || t.includes('treasure island')) return 6;
  // District 8 — Castro, Noe Valley, Glen Park, Eureka Valley
  if (t.includes('castro') || t.includes('noe valley') || t.includes('glen park') ||
      t.includes('eureka valley') || t.includes('dolores heights')) return 8;
  // District 5 — Haight, Fillmore, Western Addition, Hayes Valley, Divisadero
  if (t.includes('haight') || t.includes('fillmore') || t.includes('western addition') ||
      t.includes('hayes') || t.includes('divisadero') || t.includes('lower haight') ||
      t.includes('panhandle') || t.includes('japantown')) return 5;
  // District 4 — Sunset, Parkside, Outer Sunset
  if (t.includes('sunset') || t.includes('parkside') || t.includes('outer sunset') ||
      t.includes('inner sunset')) return 4;
  // District 7 — West Portal, Forest Hill, Miraloma, Diamond Heights
  if (t.includes('west portal') || t.includes('forest hill') || t.includes('st. francis') ||
      t.includes('miraloma') || t.includes('diamond heights') || t.includes('balboa')) return 7;
  // District 1 — Richmond, Outer Richmond, Laurel Heights
  if (t.includes('richmond') || t.includes('jordan park') || t.includes('inner richmond') ||
      t.includes('outer richmond') || t.includes('laurel heights') || t.includes('seacliff')) return 1;
  // District 3 — North Beach, Chinatown, Telegraph Hill, Russian Hill, Fisherman's Wharf
  if (t.includes('north beach') || t.includes('chinatown') || t.includes('telegraph hill') ||
      t.includes('russian hill') || t.includes("fisherman") || t.includes('jackson square')) return 3;
  // District 2 — Marina, Pacific Heights, Cow Hollow, Presidio Heights
  if (t.includes('marina') || t.includes('pacific heights') || t.includes('cow hollow') ||
      t.includes('presidio heights') || t.includes('union street')) return 2;
  return 6;
}

// Maps SF zip codes to supervisorial districts (used when Legistar titles contain a zip code)
function guessDistrictByZip(zip) {
  const zipMap = {
    '94102': 5, '94103': 6, '94104': 3, '94105': 6,
    '94107': 10, '94108': 3, '94109': 3, '94110': 9,
    '94111': 3, '94112': 11, '94114': 8, '94115': 5,
    '94116': 4, '94117': 5, '94118': 1, '94121': 1,
    '94122': 4, '94123': 2, '94124': 10, '94127': 7,
    '94129': 2, '94130': 6, '94131': 8, '94132': 11,
    '94133': 3, '94134': 10,
  };
  return zipMap[zip] || 6;
}

