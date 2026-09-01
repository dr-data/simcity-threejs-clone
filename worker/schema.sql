-- Classroom SimCity D1 schema
-- Run: wrangler d1 execute classroom-simcity --file=worker/schema.sql

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  email TEXT,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  is_admin INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  last_login_at TEXT,
  last_login_ip TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS player_stats (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  total_sessions INTEGER NOT NULL DEFAULT 0,
  best_score INTEGER NOT NULL DEFAULT 0,
  best_residents INTEGER NOT NULL DEFAULT 0,
  best_developed_zones INTEGER NOT NULL DEFAULT 0,
  best_disaster_resilience REAL NOT NULL DEFAULT 0,
  total_casualties INTEGER NOT NULL DEFAULT 0,
  total_injured INTEGER NOT NULL DEFAULT 0,
  total_disaster_cost INTEGER NOT NULL DEFAULT 0,
  total_zones_damaged INTEGER NOT NULL DEFAULT 0,
  last_played TEXT
);

CREATE TABLE IF NOT EXISTS game_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score INTEGER NOT NULL DEFAULT 0,
  residents INTEGER NOT NULL DEFAULT 0,
  developed_zones INTEGER NOT NULL DEFAULT 0,
  disaster_resilience REAL NOT NULL DEFAULT 0,
  disasters_survived INTEGER NOT NULL DEFAULT 0,
  casualties INTEGER NOT NULL DEFAULT 0,
  injured INTEGER NOT NULL DEFAULT 0,
  disaster_cost INTEGER NOT NULL DEFAULT 0,
  zones_damaged INTEGER NOT NULL DEFAULT 0,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_user_id INTEGER NOT NULL REFERENCES users(id),
  target_user_id INTEGER,
  action TEXT NOT NULL,
  changes TEXT,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO app_settings (key, value) VALUES ('leaderboard_hidden', 'false');
INSERT OR IGNORE INTO app_settings (key, value) VALUES ('class_board_code', 'HSU2026');

CREATE TABLE IF NOT EXISTS city_restore_codes (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS disaster_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER REFERENCES game_sessions(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  type TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'moderate',
  casualties INTEGER NOT NULL DEFAULT 0,
  injured INTEGER NOT NULL DEFAULT 0,
  cost INTEGER NOT NULL DEFAULT 0,
  zones_damaged INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
