-- Migration: Fix missing last_active column in telegram_users table

ALTER TABLE telegram_users ADD COLUMN IF NOT EXISTS last_active TIMESTAMP DEFAULT NOW();
