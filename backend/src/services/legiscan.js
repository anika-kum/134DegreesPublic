// LegiScan bill scraper: pulls housing-related bills from the California legislature
// and US Congress via the LegiScan public API. Requires LEGISCAN_API_KEY in .env.
// Results are deduplicated by legiscan_bill_id; existing bills are updated only
// when last_action_date changes (content_hash check) to avoid re-running LLM enrichment.

import axios from 'axios';
import db from '../db/index.js';

const LEGISCAN_BASE = 'https://api.legiscan.com/';

// Broad queries to catch the range of SF-relevant housing legislation
const SEARCHES = [
  { state: 'CA', query: 'affordable housing rent eviction' },
  { state: 'CA', query: 'zoning housing voucher AMI low income' },
  { state: 'US', query: 'affordable housing act section 8 voucher' },
  { state: 'US', query: 'housing assistance eviction prevention' },
];

export async function scrapeLegiscanBills() {
  const key = process.env.LEGISCAN_API_KEY;
  if (!key) {
    console.warn('[legiscan] LEGISCAN_API_KEY not set — skipping bill scrape');
    return;
  }

  console.log('[legiscan] Starting bill scrape...');
  const seen = new Set(); // dedup across multiple searches

  for (const { state, query } of SEARCHES) {
    try {
      const { data } = await axios.get(LEGISCAN_BASE, {
        params: { key, op: 'getSearchRaw', state, query, year: 2 },
        timeout: 15000,
      });

      const results = data?.searchresult?.results || [];
      for (const bill of results.slice(0, 15)) {
        const billId = String(bill.bill_id);
        if (seen.has(billId)) continue;
        seen.add(billId);

        // Hash on last_action_date + status so we only re-enrich when the bill changes
        const hash = `${bill.last_action_date}|${bill.status}`;

        const existing = db.prepare('SELECT id, content_hash FROM bills WHERE legiscan_bill_id = ?').get(billId);
        if (existing) {
          if (existing.content_hash !== hash) {
            // Bill updated since last scrape — clear enrichment so it re-runs tonight
            db.prepare(`UPDATE bills SET content_hash = ?, status = ?, llm_enriched_at = NULL,
              last_scraped = datetime('now') WHERE legiscan_bill_id = ?`)
              .run(hash, String(bill.status ?? ''), billId);
          }
          continue;
        }

        db.prepare(`
          INSERT OR IGNORE INTO bills
            (legiscan_bill_id, title, status, government_level, bill_number, session, state, url, content_hash)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          billId,
          String(bill.title ?? '').slice(0, 300),
          String(bill.status ?? ''),
          state === 'US' ? 'federal' : 'state',
          String(bill.bill_number ?? ''),
          String(bill.session_id ?? ''),
          state,
          String(bill.url ?? ''),
          hash,
        );
      }
    } catch (err) {
      console.warn(`[legiscan] Search failed (${state}: "${query}"):`, err.message);
    }
  }

  console.log('[legiscan] Done.');
}
