// Database initialization using Node's built-in SQLite module (node:sqlite).
// Chosen over better-sqlite3 because it requires no native compilation —
// critical since Node 24 can't download build headers in restricted environments.
// DatabaseSync is synchronous and single-file, which simplifies the whole backend.

import { DatabaseSync } from 'node:sqlite';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '../../data/advocate.db');
// Ensure the data/ directory exists before opening the database file
mkdirSync(join(__dirname, '../../data'), { recursive: true });

const db = new DatabaseSync(DB_PATH);

// WAL mode allows concurrent reads during writes — important since the scraper
// and API requests run at the same time
db.exec('PRAGMA journal_mode = WAL');
// Enforce foreign key constraints (SQLite disables them by default)
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS bills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    legiscan_bill_id TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT,
    government_level TEXT NOT NULL,  -- 'state' or 'federal'
    bill_number TEXT,
    session TEXT,
    state TEXT,  -- 'CA' or 'US'
    -- JSON array of rep objects: [{ name, title, level, email, reason }]
    relevant_reps TEXT,
    url TEXT,
    content_hash TEXT,
    llm_enriched_at TEXT,
    last_scraped TEXT DEFAULT (datetime('now')),
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    -- SF has exactly 11 supervisorial districts
    district INTEGER NOT NULL CHECK(district BETWEEN 1 AND 11),
    housing_status TEXT NOT NULL,
    tenure_years INTEGER,
    income_bracket TEXT,
    -- Stored as JSON array (e.g. '["English","Spanish"]') since SQLite has no array type
    languages TEXT DEFAULT '["English"]',
    has_children INTEGER DEFAULT 0,  -- SQLite has no boolean; 0/1 used
    occupation TEXT,
    -- Free-text story fed directly into Claude prompts for personalization
    personal_story TEXT,
    phone TEXT,
    sms_alerts INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    address TEXT NOT NULL,
    district INTEGER NOT NULL,
    type TEXT NOT NULL,
    status TEXT NOT NULL,
    units_total INTEGER,
    units_affordable INTEGER,
    -- JSON array of AMI percentage strings (e.g. '["30% AMI","80% AMI"]')
    ami_levels TEXT,
    description TEXT,
    hearing_date TEXT,       -- ISO date: YYYY-MM-DD
    comment_deadline TEXT,   -- unused; kept to avoid schema migration
    application_open_date TEXT, -- unused; kept to avoid schema migration
    portal_url TEXT,
    -- UNIQUE ensures INSERT OR IGNORE deduplicates across scraper runs
    case_number TEXT UNIQUE,
    lead_agency TEXT,
    supervisor TEXT,
    supervisor_email TEXT,
    state_assembly TEXT,
    state_senate TEXT,
    -- Incremented each time any user submits advocacy content for this project
    coalition_count INTEGER DEFAULT 0,
    source TEXT DEFAULT 'manual',  -- 'manual' or 'Legistar'
    last_scraped TEXT DEFAULT (datetime('now')),
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Tracks which users want SMS alerts for which projects
  CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, project_id)  -- prevents duplicate subscriptions
  );

  -- Audit log of every email/tweet/call script a user generates and sends
  CREATE TABLE IF NOT EXISTS advocacy_actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    channel TEXT NOT NULL,  -- 'email', 'tweet', or 'call'
    content TEXT NOT NULL,
    tone TEXT,              -- 'emotional', 'data-driven', 'formal' (email only)
    sent_at TEXT DEFAULT (datetime('now'))
  );

  -- Live SF resources: shelters, rent relief, Section 8 waitlists
  CREATE TABLE IF NOT EXISTS resources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL,  -- 'emergency_shelter', 'rent_relief', 'section8', 'affordable_housing_list'
    address TEXT,
    district INTEGER,
    phone TEXT,
    url TEXT,
    capacity INTEGER,
    available_beds INTEGER,  -- Updated by scraper; null for non-shelter resources
    status TEXT DEFAULT 'active',
    notes TEXT,
    last_updated TEXT DEFAULT (datetime('now'))
  );

  -- Record of SMS messages sent via Twilio; used to prevent duplicate alerts
  CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    sent_at TEXT DEFAULT (datetime('now'))
  );
`);

// Safe migrations: add new columns to existing projects table without dropping data.
// ALTER TABLE silently throws "duplicate column" on re-runs — we catch and ignore that.
for (const ddl of [
  'ALTER TABLE projects ADD COLUMN relevant_reps TEXT',
  'ALTER TABLE projects ADD COLUMN content_hash TEXT',
  'ALTER TABLE projects ADD COLUMN llm_enriched_at TEXT',
]) {
  try { db.exec(ddl); } catch {}
}

export default db;
