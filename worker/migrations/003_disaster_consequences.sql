-- Disaster consequence tracking for sessions and leaderboard
ALTER TABLE game_sessions ADD COLUMN casualties INTEGER NOT NULL DEFAULT 0;
ALTER TABLE game_sessions ADD COLUMN injured INTEGER NOT NULL DEFAULT 0;
ALTER TABLE game_sessions ADD COLUMN disaster_cost INTEGER NOT NULL DEFAULT 0;
ALTER TABLE game_sessions ADD COLUMN zones_damaged INTEGER NOT NULL DEFAULT 0;

ALTER TABLE player_stats ADD COLUMN total_casualties INTEGER NOT NULL DEFAULT 0;
ALTER TABLE player_stats ADD COLUMN total_injured INTEGER NOT NULL DEFAULT 0;
ALTER TABLE player_stats ADD COLUMN total_disaster_cost INTEGER NOT NULL DEFAULT 0;
ALTER TABLE player_stats ADD COLUMN total_zones_damaged INTEGER NOT NULL DEFAULT 0;
