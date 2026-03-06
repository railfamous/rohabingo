-- Migration: Add website monitors table for auto-posting from websites
-- Created: 2026-02-04

-- website_monitors: stores websites to monitor for new media
CREATE TABLE IF NOT EXISTS website_monitors (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  website_url TEXT NOT NULL,
  check_interval_minutes INTEGER DEFAULT 60,
  media_types TEXT[] DEFAULT ARRAY['video', 'image'],
  target_chat_ids BIGINT[],
  css_selector TEXT,
  caption_template TEXT DEFAULT '',
  is_active BOOLEAN DEFAULT TRUE,
  last_checked_at TIMESTAMP,
  last_error TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- website_media_posts: tracks posted media to avoid duplicates
CREATE TABLE IF NOT EXISTS website_media_posts (
  id SERIAL PRIMARY KEY,
  monitor_id INTEGER REFERENCES website_monitors(id) ON DELETE CASCADE,
  media_url TEXT NOT NULL,
  media_type VARCHAR(20),
  title TEXT,
  posted_at TIMESTAMP DEFAULT NOW(),
  chat_ids_posted BIGINT[],
  UNIQUE(monitor_id, media_url)
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_website_monitors_active ON website_monitors(is_active);
CREATE INDEX IF NOT EXISTS idx_website_monitors_next_check ON website_monitors(last_checked_at, check_interval_minutes);
CREATE INDEX IF NOT EXISTS idx_website_media_posts_monitor ON website_media_posts(monitor_id);
