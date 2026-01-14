-- Add AI pause functionality for human takeover
-- Allows admin to stop chatbot from replying to specific contacts

-- Add ai_paused column to contact_profiles
ALTER TABLE contact_profiles
ADD COLUMN IF NOT EXISTS ai_paused BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ai_paused_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS ai_paused_reason TEXT;

-- Add comment for documentation
COMMENT ON COLUMN contact_profiles.ai_paused IS 'When true, chatbot will not auto-reply to this contact (human takeover mode)';
COMMENT ON COLUMN contact_profiles.ai_paused_at IS 'Timestamp when AI was paused for this contact';
COMMENT ON COLUMN contact_profiles.ai_paused_reason IS 'Optional reason for pausing AI (e.g., "Admin takeover", "VIP customer")';

-- Create index for efficient filtering of paused contacts
CREATE INDEX IF NOT EXISTS idx_contact_profiles_ai_paused
ON contact_profiles(chatbot_id, ai_paused)
WHERE ai_paused = true;
