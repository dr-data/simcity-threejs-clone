-- AI usage tracking (daily quotas per user or guest IP)
CREATE TABLE IF NOT EXISTS ai_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usage_key TEXT NOT NULL,
  user_id INTEGER,
  date TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  UNIQUE(usage_key, date)
);
