-- Migration: Fix missing tables that should have been in schema.sql
-- This runs first because of the filename sorting (000_...)

-- Create telegram_channels table
CREATE TABLE IF NOT EXISTS telegram_channels (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    title VARCHAR(255),
    link VARCHAR(255),
    description TEXT,
    is_public BOOLEAN DEFAULT TRUE,
    is_private BOOLEAN DEFAULT FALSE,
    disabled BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    promotion_id INTEGER,
    require_premium BOOLEAN DEFAULT FALSE,
    require_finish_task_id INTEGER,
    require_finish_task_type VARCHAR(50)
);

-- Create bot_chats table
CREATE TABLE IF NOT EXISTS bot_chats (
    chat_id BIGINT PRIMARY KEY,
    chat_type VARCHAR(50),
    title VARCHAR(255),
    username VARCHAR(255),
    last_seen_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create chat_moderation_settings table
CREATE TABLE IF NOT EXISTS chat_moderation_settings (
    chat_id BIGINT PRIMARY KEY,
    enabled BOOLEAN DEFAULT TRUE,
    welcome_enabled BOOLEAN DEFAULT FALSE,
    welcome_text TEXT,
    delete_links_enabled BOOLEAN DEFAULT FALSE,
    auto_mute_enabled BOOLEAN DEFAULT FALSE,
    auto_mute_seconds INTEGER DEFAULT 3600,
    delete_links_config JSONB,
    updated_at TIMESTAMP DEFAULT NOW()
);
