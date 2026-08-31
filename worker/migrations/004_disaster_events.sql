-- Per-disaster event log (random and player-triggered)
ALTER TABLE game_sessions ADD COLUMN disaster_log TEXT;

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
