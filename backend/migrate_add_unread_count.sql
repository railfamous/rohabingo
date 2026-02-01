-- Add unread_count to conversations
ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS unread_count INT DEFAULT 0;

-- Index for quickly finding chats with unread messages
CREATE INDEX IF NOT EXISTS idx_conversations_unread_count ON conversations(unread_count);
