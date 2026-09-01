-- HSU ID login extras: board code, last-login audit, ID-bound restore slips
INSERT OR IGNORE INTO app_settings (key, value) VALUES ('class_board_code', 'HSU2026');

ALTER TABLE users ADD COLUMN last_login_at TEXT;
ALTER TABLE users ADD COLUMN last_login_ip TEXT;

CREATE TABLE IF NOT EXISTS city_restore_codes (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
