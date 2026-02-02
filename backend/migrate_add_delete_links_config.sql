DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'chat_moderation_settings'
        AND column_name = 'delete_links_config'
    ) THEN
        ALTER TABLE chat_moderation_settings
        ADD COLUMN delete_links_config JSONB DEFAULT NULL;
    END IF;
END $$;
