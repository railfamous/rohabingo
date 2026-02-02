-- Remove duplicate 'group' entries if a 'supergroup' with the same title exists
-- This is a heuristic fix for the user's issue.

DELETE FROM bot_chats
WHERE chat_id IN (
    SELECT g.chat_id
    FROM bot_chats g
    JOIN bot_chats sg ON g.title = sg.title
    WHERE g.chat_type = 'group'
      AND sg.chat_type = 'supergroup'
      AND g.chat_id != sg.chat_id
);

-- Note: We are strictly deleting the 'group' entry.
-- We assume the 'supergroup' entry is the active one.
-- Settings for the old group might be lost if not migrated manually, 
-- but simpler to just clean up the UI as requested.
