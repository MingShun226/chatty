-- ==================================================
-- n8n Integration for Multi-Tenant SaaS
-- ==================================================
-- This adds n8n webhook configuration per chatbot
-- Each chatbot can have its own n8n workflow
-- ==================================================

-- Add n8n configuration columns to avatars table
ALTER TABLE avatars
ADD COLUMN IF NOT EXISTS n8n_webhook_url TEXT,
ADD COLUMN IF NOT EXISTS n8n_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS n8n_configured_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS n8n_last_used_at TIMESTAMPTZ;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_avatars_n8n_enabled ON avatars(n8n_enabled) WHERE n8n_enabled = TRUE;

-- Add comment
COMMENT ON COLUMN avatars.n8n_webhook_url IS 'n8n webhook URL for this chatbot (e.g., https://n8n.yourcompany.com/webhook/chatbot-abc123)';
COMMENT ON COLUMN avatars.n8n_enabled IS 'Whether n8n integration is enabled for this chatbot';
COMMENT ON COLUMN avatars.n8n_configured_at IS 'When n8n was configured for this chatbot';
COMMENT ON COLUMN avatars.n8n_last_used_at IS 'Last time n8n webhook was called';

-- ==================================================
-- DONE! Run this in Supabase SQL Editor
-- ==================================================
