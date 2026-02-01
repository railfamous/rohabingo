-- Cleanup (allows re-running schema.sql). WARNING: this is destructive.
-- Drop dependent views/functions first, then tables.
DROP TABLE IF EXISTS telegram_users;

-- Create users table
CREATE TABLE telegram_users (
  id BIGINT PRIMARY KEY,
  username VARCHAR(255),
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255),
  language_code VARCHAR(10) DEFAULT 'en',
  photo_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);









-- Create task_progress table
CREATE TABLE IF NOT EXISTS task_progress (
  id SERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES telegram_users(id),
  task_type VARCHAR(50) NOT NULL,
  task_id INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  points_earned INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, task_type, task_id)
);

-- Create index for task progress lookups
CREATE INDEX IF NOT EXISTS idx_task_progress_user_id ON task_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_task_progress_task_type ON task_progress(task_type);
CREATE INDEX IF NOT EXISTS idx_task_progress_status ON task_progress(status);

-- Create settings table for point configurations
CREATE TABLE IF NOT EXISTS settings (
  id SERIAL PRIMARY KEY,
  key VARCHAR(100) NOT NULL UNIQUE,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default settings
INSERT INTO settings (key, value, description) VALUES
  ('points_on_channel_join', '20', 'Points awarded for joining a Telegram channel'),
  ('points_on_daily_login', '5', 'Points awarded for daily login')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description;

-- Create quizzes table

