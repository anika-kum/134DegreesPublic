// Project routes: browse/filter SF housing projects, submit advocacy actions,
// and manage per-user subscriptions for SMS alerts.

import { Router } from 'express';
import db from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// GET /projects?district=9&status=hearing&type=affordable
// Returns all projects sorted by soonest comment deadline first,
// so the most urgent actions always appear at the top.
router.get('/', (req, res) => {
  const { district, status, type } = req.query;
  let sql = 'SELECT * FROM projects WHERE 1=1';
  const params = [];
  if (district) { sql += ' AND district = ?'; params.push(Number(district)); }
  // LIKE allows partial matches (e.g. "hearing" matches "Planning Commission Hearing Scheduled")
  if (status) { sql += ' AND status LIKE ?'; params.push(`%${status}%`); }
  if (type) { sql += ' AND type LIKE ?'; params.push(`%${type}%`); }
  sql += ' ORDER BY hearing_date ASC';
  const projects = db.prepare(sql).all(...params);
  res.json(projects.map(parseProject));
});

// GET /projects/:id — full project detail including all fields for the advocacy panel
router.get('/:id', (req, res) => {
  const p = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Not found' });
  res.json(parseProject(p));
});

// POST /projects/:id/advocate
// Called after a user copies/sends their generated content.
// Increments the coalition counter (social proof) and logs the action for history.
router.post('/:id/advocate', requireAuth, (req, res) => {
  const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Not found' });

  db.prepare('UPDATE projects SET coalition_count = coalition_count + 1 WHERE id = ?').run(req.params.id);

  const { channel, content, tone } = req.body;
  db.prepare('INSERT INTO advocacy_actions (user_id, project_id, channel, content, tone) VALUES (?, ?, ?, ?, ?)')
    .run(req.user.id, req.params.id, channel, content, tone);

  // Return updated count so the UI can update immediately without a refetch
  const updated = db.prepare('SELECT coalition_count FROM projects WHERE id = ?').get(req.params.id);
  res.json({ success: true, coalition_count: updated.coalition_count });
});

// POST /projects/:id/subscribe
// INSERT OR IGNORE silently handles duplicate subscriptions from repeated taps
router.post('/:id/subscribe', requireAuth, (req, res) => {
  try {
    db.prepare('INSERT OR IGNORE INTO subscriptions (user_id, project_id) VALUES (?, ?)').run(req.user.id, req.params.id);
    res.json({ subscribed: true });
  } catch {
    res.status(500).json({ error: 'Subscription failed' });
  }
});

// DELETE /projects/:id/subscribe
router.delete('/:id/subscribe', requireAuth, (req, res) => {
  db.prepare('DELETE FROM subscriptions WHERE user_id = ? AND project_id = ?').run(req.user.id, req.params.id);
  res.json({ subscribed: false });
});

// GET /projects/user/subscriptions
// Returns full project rows (not just IDs) so the Alerts tab can render cards directly
router.get('/user/subscriptions', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT p.* FROM projects p
    JOIN subscriptions s ON s.project_id = p.id
    WHERE s.user_id = ?
    ORDER BY p.hearing_date ASC
  `).all(req.user.id);
  res.json(rows.map(parseProject));
});

function parseProject(p) {
  return {
    ...p,
    ami_levels: tryParse(p.ami_levels, []),
    relevant_reps: tryParse(p.relevant_reps, []),
  };
}

// Safe JSON.parse that returns a fallback instead of throwing on malformed data
function tryParse(val, fallback) {
  try { return JSON.parse(val); } catch { return fallback; }
}

export default router;
