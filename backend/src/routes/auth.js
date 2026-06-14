// Authentication routes: register, login, and profile update.
// All onboarding fields (housing status, personal story, etc.) are collected
// at registration and stored so Claude can personalize advocacy content
// without asking users to re-enter context every time.

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../db/index.js';
import { sendConfirmationText } from '../services/twilio.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

// Strips non-digits and prepends +1 for US numbers, producing E.164 format.
// Returns null for empty/falsy input so the DB stores NULL rather than a bad string.
function normalizePhone(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`; // non-US: trust the user, just strip formatting
}

// node:sqlite returns booleans as 0/1 integers and JSON columns as raw strings.
// This normalizes a raw DB row into the shape the frontend User interface expects.
function serializeUser(row) {
  if (!row) return null;
  return {
    ...row,
    sms_alerts: Boolean(row.sms_alerts),
    has_children: Boolean(row.has_children),
    languages: typeof row.languages === 'string'
      ? JSON.parse(row.languages)
      : (row.languages ?? ['English']),
  };
}

// POST /auth/register
// Creates a new user account with full onboarding profile.
// Returns a JWT token and the user object so the client can skip a separate login step.
router.post('/register', async (req, res) => {
  const {
    email, password, name, district,
    housing_status, tenure_years, income_bracket,
    languages, has_children, occupation, personal_story, phone, sms_alerts,
  } = req.body;

  if (!email || !password || !name || !district) {
    return res.status(400).json({ error: 'email, password, name, and district are required' });
  }

  try {
    // bcrypt cost factor 10 is the standard balance of security vs. speed
    const hash = await bcrypt.hash(password, 10);
    const stmt = db.prepare(`
      INSERT INTO users
        (email, password_hash, name, district, housing_status, tenure_years,
         income_bracket, languages, has_children, occupation, personal_story, phone, sms_alerts)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      email, hash, name, district,
      housing_status || 'renter',
      tenure_years || null,
      income_bracket || null,
      // languages is an array on the client; SQLite stores it as a JSON string
      JSON.stringify(languages || ['English']),
      has_children ? 1 : 0,
      occupation || null,
      personal_story || null,
      normalizePhone(phone),
      sms_alerts ? 1 : 0,
    );
    // Token includes district so API calls can filter projects by district without a DB lookup
    const token = jwt.sign({ id: result.lastInsertRowid, email, district }, JWT_SECRET, { expiresIn: '30d' });
    // Re-fetch to return the full sanitized user (excludes password_hash)
    const user = serializeUser(db.prepare('SELECT id, email, name, district, housing_status, income_bracket, languages, has_children, occupation, personal_story, phone, sms_alerts FROM users WHERE id = ?').get(result.lastInsertRowid));
    if (phone) sendConfirmationText(normalizePhone(phone), name).catch(console.error);
    res.json({ token, user });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Email already registered' });
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /auth/login
// Returns a fresh 30-day token; never exposes the password hash to the client.
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  // Return the same error for missing user and wrong password to avoid email enumeration
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign({ id: user.id, email: user.email, district: user.district }, JWT_SECRET, { expiresIn: '30d' });
  // Destructure out password_hash before sending the user object
  const { password_hash, ...safeUser } = user;
  res.json({ token, user: serializeUser(safeUser) });
});

// PATCH /auth/profile
// Updates any subset of the user's advocacy profile fields.
// Only fields explicitly included in the request body are modified.
router.patch('/profile', async (req, res) => {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'Unauthorized' });
  let userId;
  try {
    ({ id: userId } = jwt.verify(header.slice(7), JWT_SECRET));
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }

  // Allowlist of updatable fields — prevents arbitrary column injection
  const fields = ['name', 'district', 'housing_status', 'tenure_years', 'income_bracket', 'languages', 'has_children', 'occupation', 'personal_story', 'phone', 'sms_alerts'];
  const updates = [];
  const values = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      updates.push(`${f} = ?`);
      let val = f === 'languages' ? JSON.stringify(req.body[f]) : req.body[f];
      // node:sqlite doesn't accept JS booleans — coerce to 0/1
      if (typeof val === 'boolean') val = val ? 1 : 0;
      values.push(val);
    }
  }
  if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });

  // Capture old phone before the update so we can detect a new number being added
  const oldPhone = db.prepare('SELECT phone, name FROM users WHERE id = ?').get(userId);

  values.push(userId);
  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  const user = serializeUser(db.prepare('SELECT id, email, name, district, housing_status, income_bracket, languages, has_children, occupation, personal_story, phone, sms_alerts FROM users WHERE id = ?').get(userId));
    // JWT references a user that no longer exists (e.g. DB was cleared during dev)

  if (!user) return res.status(401).json({ error: 'User not found' });

  const newPhone = req.body.phone ? normalizePhone(req.body.phone) : undefined;
  if (newPhone && newPhone !== oldPhone?.phone) {
    sendConfirmationText(newPhone, user.name).catch(console.error);
  }

  // Re-issue the JWT when district changes since district is encoded in the token
  let token;
  if (req.body.district !== undefined) {
    token = jwt.sign({ id: userId, email: user.email, district: user.district }, JWT_SECRET, { expiresIn: '30d' });
  }
  res.json({ user, ...(token ? { token } : {}) });
});

export default router;
