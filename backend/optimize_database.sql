-- Performance optimization indexes for the GameMiniApp database
-- Run this to improve query performance



-- Indexes for task_progress table
CREATE INDEX IF NOT EXISTS idx_task_progress_user_task ON task_progress (user_id, task_type, task_id);
CREATE INDEX IF NOT EXISTS idx_task_progress_user_status ON task_progress (user_id, status);
CREATE INDEX IF NOT EXISTS idx_task_progress_status ON task_progress (status);

-- Indexes for telegram_users table

CREATE INDEX IF NOT EXISTS idx_telegram_users_points ON telegram_users (points);
CREATE INDEX IF NOT EXISTS idx_telegram_users_last_active ON telegram_users (last_active);









-- Indexes for settings table
CREATE INDEX IF NOT EXISTS idx_settings_key ON settings (key);

-- Update table statistics for better query planning
ANALYZE telegram_users;
ANALYZE task_progress;

ANALYZE settings;

-- Add a comment for tracking
COMMENT ON INDEX idx_task_progress_user_task IS 'Optimizes task status lookups';
