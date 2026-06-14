// Bills route: exposes housing legislation scraped from Congress.gov and OpenStates.
// No auth required — bills are public information.

import { Router } from 'express';
import db from '../db/index.js';

const router = Router();

// GET /bills?level=state|federal&state=CA|US
// Returns all bills sorted by most recently scraped (newest first).
// relevant_reps may be [] on bills not yet enriched; frontend handles gracefully.
router.get('/', (req, res) => {
  const { level, state } = req.query;
  let sql = 'SELECT * FROM bills WHERE 1=1';
  const params = [];
  if (level) { sql += ' AND government_level = ?'; params.push(level); }
  if (state) { sql += ' AND state = ?'; params.push(state); }
  sql += ' ORDER BY last_scraped DESC LIMIT 50';

  const bills = db.prepare(sql).all(...params).map(parseBill);
  res.json(bills);
});

// GET /bills/:id
router.get('/:id', (req, res) => {
  const bill = db.prepare('SELECT * FROM bills WHERE id = ?').get(req.params.id);
  if (!bill) return res.status(404).json({ error: 'Not found' });
  res.json(parseBill(bill));
});

function parseBill(b) {
  return { ...b, relevant_reps: tryParse(b.relevant_reps, []) };
}

function tryParse(val, fallback) {
  try { return JSON.parse(val); } catch { return fallback; }
}

export default router;
