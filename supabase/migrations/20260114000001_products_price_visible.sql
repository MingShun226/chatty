-- Add price_visible column to avatars table (global setting for entire catalog)
-- When false, the chatbot won't show prices and will notify the human instead

ALTER TABLE avatars
ADD COLUMN IF NOT EXISTS price_visible BOOLEAN DEFAULT true;

-- Add comment for clarity
COMMENT ON COLUMN avatars.price_visible IS 'When false, prices are hidden from customers for entire catalog and admin is notified when customer asks about pricing';

-- Update existing rows to have price_visible = true (show price by default)
UPDATE avatars SET price_visible = true WHERE price_visible IS NULL;

-- Add shareable column to avatar_knowledge_files table (per-document setting)
-- When true, chatbot can share this specific document with users when asked
-- When false, document is used for AI reference only but won't be shared

ALTER TABLE avatar_knowledge_files
ADD COLUMN IF NOT EXISTS shareable BOOLEAN DEFAULT false;

-- Add comment for clarity
COMMENT ON COLUMN avatar_knowledge_files.shareable IS 'When true, chatbot can send this document to users when asked. When false, document is used for AI reference only and not shared with customers.';

-- Update existing rows to have shareable = false (don't share by default for privacy)
UPDATE avatar_knowledge_files SET shareable = false WHERE shareable IS NULL;
