-- Add delete_links_config JSONB column to chat_moderation_settings
ALTER TABLE chat_moderation_settings
ADD COLUMN IF NOT EXISTS delete_links_config JSONB DEFAULT NULL;

-- Add key for global settings if we want to store it there too
-- The settings table is key-value (text, text), so we might store it as a JSON string
-- But usually settings table structure is (key TEXT PRIMARY KEY, value TEXT)
-- So no schema change needed for settings table, just inserting a default if needed.
-- However, let's verify settings table structure. Wrapper code treats it as KV.

-- Ensure column exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_moderation_settings' AND column_name = 'delete_links_config') THEN
        ALTER TABLE chat_moderation_settings ADD COLUMN delete_links_config JSONB DEFAULT NULL;
    END IF;
END $$;
