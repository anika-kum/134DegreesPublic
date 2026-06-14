// Advocacy routes: generate AI content via Claude and retrieve action history.
// Generation is the core feature of the app — this route fetches the full user
// profile and project details, passes them to Claude, and returns personalized
// email/tweet/call script content ready to copy or send.

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import db from '../db/index.js';
import { generateAdvocacyEmail, generateTweet, generateCallScript, generateBillEmail, generateBillTweet, generateBillCallScript } from '../services/claude.js';

const router = Router();

// POST /advocacy/generate
// Accepts either project_id or bill_id (not both).
// Optional: target_rep — rep object from relevant_reps to address specifically.
router.post('/generate', requireAuth, async (req, res) => {
  const { project_id, bill_id, channel, tone, target_rep } = req.body;
  if ((!project_id && !bill_id) || !channel) {
    return res.status(400).json({ error: 'project_id or bill_id, and channel are required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

  try {
    let content;

    if (bill_id) {
      const bill = db.prepare('SELECT * FROM bills WHERE id = ?').get(bill_id);
      if (!bill) return res.status(404).json({ error: 'Bill not found' });
      const parsedBill = { ...bill, relevant_reps: tryParse(bill.relevant_reps, []) };

      if (channel === 'email') content = await generateBillEmail({ user, bill: parsedBill, tone: tone || 'emotional', targetRep: target_rep || null });
      else if (channel === 'tweet') content = await generateBillTweet({ bill: parsedBill });
      else if (channel === 'call') content = await generateBillCallScript({ user, bill: parsedBill, targetRep: target_rep || null });
      else return res.status(400).json({ error: 'channel must be email, tweet, or call' });

    } else {
      const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(project_id);
      if (!project) return res.status(404).json({ error: 'Project not found' });
      const parsedProject = { ...project, ami_levels: tryParse(project.ami_levels, []) };

      if (channel === 'email') content = await generateAdvocacyEmail({ user, project: parsedProject, tone: tone || 'emotional', targetRep: target_rep || null });
      else if (channel === 'tweet') content = await generateTweet({ user, project: parsedProject });
      else if (channel === 'call') content = await generateCallScript({ user, project: parsedProject });
      else return res.status(400).json({ error: 'channel must be email, tweet, or call' });

      // Log the action and increment coalition count for projects only
      db.prepare('UPDATE projects SET coalition_count = coalition_count + 1 WHERE id = ?').run(project_id);
      db.prepare('INSERT INTO advocacy_actions (user_id, project_id, channel, content, tone) VALUES (?, ?, ?, ?, ?)')
        .run(user.id, project_id, channel, content, tone || null);
    }

    res.json({ content, channel, project_id, bill_id, tone });
  } catch (err) {
    console.error('Claude error:', err.message);
    res.status(500).json({ error: 'AI generation failed', detail: err.message });
  }
});

// GET /advocacy/history
// Returns the last 50 advocacy actions for the current user, joined with project
// title/address so the history view doesn't need a second request per item.
router.get('/history', requireAuth, (req, res) => {
  const actions = db.prepare(`
    SELECT aa.*, p.title as project_title, p.address as project_address
    FROM advocacy_actions aa
    JOIN projects p ON p.id = aa.project_id
    WHERE aa.user_id = ?
    ORDER BY aa.sent_at DESC
    LIMIT 50
  `).all(req.user.id);
  res.json(actions);
});

function tryParse(val, fallback) {
  try { return JSON.parse(val); } catch { return fallback; }
}

export default router;
