// Manual trigger for the full nightly data pipeline.
// Runs scraper → legislation → enrichment → updates last_updated timestamp.
//
// Usage:
//   npm run update            (from backend/)
//   node src/scripts/force-update.js

import 'dotenv/config';
import { scrapeAll } from '../services/scraper.js';
import { scrapeLegislation } from '../services/legislation.js';
import { enrichUnenriched } from '../services/enrichment.js';
import db from '../db/index.js';

console.log('[force-update] Starting manual data refresh...\n');

try {
  process.stdout.write('[force-update] Scraping SF projects... ');
  await scrapeAll();
  console.log('done.');

  process.stdout.write('[force-update] Scraping legislation (Congress.gov + OpenStates)... ');
  await scrapeLegislation();
  console.log('done.');

  process.stdout.write('[force-update] Running LLM enrichment on new records... ');
  await enrichUnenriched();
  console.log('done.');

  db.prepare("INSERT OR REPLACE INTO metadata (key, value, updated_at) VALUES ('last_updated', datetime('now'), datetime('now'))").run();

  console.log('\n[force-update] All done. Database is up to date.');
} catch (err) {
  console.error('\n[force-update] Failed:', err.message);
  process.exit(1);
}
