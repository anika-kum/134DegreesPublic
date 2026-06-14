// Express server entry point.
// Mounts all API routes, registers the scraper and SMS cron jobs,
// and serves a health check endpoint for debugging connectivity.

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cron from 'node-cron';

import authRoutes from './routes/auth.js';
import projectRoutes from './routes/projects.js';
import resourceRoutes from './routes/resources.js';
import advocacyRoutes from './routes/advocacy.js';
import billRoutes from './routes/bills.js';

import { scrapeAll } from './services/scraper.js';
import { scrapeLegislation } from './services/legislation.js';
import { enrichUnenriched } from './services/enrichment.js';
import { checkAndNotifySubscribers } from './services/twilio.js';
import db from './db/index.js';
import { SF_SUPERVISORS, SF_STATE_REPS, SF_FEDERAL_REPS } from './db/constants.js';

const app = express();
// CORS required because the Expo frontend runs on a different origin (LAN IP vs localhost)
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/advocacy', advocacyRoutes);
app.use('/api/bills', billRoutes);

// GET /api/reps/:district
// Returns all levels of government relevant to a SF district:
// local (supervisor + mayor), state (assembly + senate), federal (house + senate).
app.get('/api/reps/:district', (req, res) => {
  const district = Number(req.params.district);
  const sup = SF_SUPERVISORS[district];
  if (!sup) return res.status(404).json({ error: 'District not found' });

  res.json({
    district,
    local: {
      supervisor: { ...sup, title: `District ${district} Supervisor` },
      mayor: SF_STATE_REPS.mayor,
    },
    state: {
      assembly: district <= 5 ? SF_STATE_REPS.assembly.low : SF_STATE_REPS.assembly.high,
      senate: SF_STATE_REPS.senate,
    },
    federal: {
      house: SF_FEDERAL_REPS.house,
      senate: SF_FEDERAL_REPS.senate,
    },
  });
});

// GET /api/stats — aggregate numbers for the dashboard hero section
app.get('/api/stats', (_req, res) => {
  const total = db.prepare('SELECT COUNT(*) as c FROM projects').get().c;
  const totalUnits = db.prepare('SELECT SUM(units_affordable) as c FROM projects WHERE units_affordable IS NOT NULL').get().c || 0;
  const avgCoalition = db.prepare('SELECT AVG(coalition_count) as c FROM projects').get().c || 0;
  const upcoming = db.prepare("SELECT COUNT(*) as c FROM projects WHERE hearing_date >= date('now')").get().c;
  res.json({ total_projects: total, total_affordable_units: totalUnits, avg_supporters: Math.round(avgCoalition), active_comment_windows: upcoming });
});

// GET /api/last-updated — timestamp of the most recent full nightly data refresh
app.get('/api/last-updated', (_req, res) => {
  const row = db.prepare("SELECT value FROM metadata WHERE key = 'last_updated'").get();
  res.json({ last_updated: row?.value || null });
});

// Used by the frontend to verify backend connectivity on first load
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Writes or updates the last_updated metadata key
function setLastUpdated() {
  db.prepare("INSERT OR REPLACE INTO metadata (key, value, updated_at) VALUES ('last_updated', datetime('now'), datetime('now'))").run();
}

// Scrape SF Planning Commission + legislation on startup so data is fresh immediately,
// then repeat every 6 hours (cron: minute 0 of every 6th hour).
// Enrichment runs after the startup scrape to populate relevant_reps on new records.
scrapeAll().then(() => scrapeLegislation()).then(() => enrichUnenriched().catch(console.error));
cron.schedule('0 */6 * * *', () => scrapeAll().then(() => enrichUnenriched().catch(console.error)));

// Nightly at 2 AM: pull LegiScan bills, enrich any outstanding records, update timestamp.
// Separate from the 6-hour SF scrape to keep LegiScan API usage predictable.
cron.schedule('0 2 * * *', async () => {
  console.log('[nightly] Starting nightly data refresh...');
  await scrapeAll();
  await scrapeLegislation();
  await enrichUnenriched();
  setLastUpdated();
  console.log('[nightly] Done.');
});

// Check for newly opened housing applications once per hour and SMS subscribed users
cron.schedule('0 * * * *', checkAndNotifySubscribers);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`134 Degrees API running on :${PORT}`));
