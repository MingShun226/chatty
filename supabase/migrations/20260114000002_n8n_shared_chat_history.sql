-- ====================================================
-- SHARED n8n CHAT HISTORY TABLE
-- Single table for ALL chatbots' conversation history
-- Session key format: {chatbotId}_{phoneNumber}
-- ====================================================

-- Create the shared n8n chat history table
-- This matches n8n Postgres Chat Memory format
CREATE TABLE IF NOT EXISTS n8n_chat_history (
  id SERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,  -- Format: {chatbotId}_{phoneNumber}
  message JSONB NOT NULL,    -- { type: 'human'|'ai', data: { content: '...' } }
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on session_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_n8n_chat_history_session_id
  ON n8n_chat_history(session_id);

-- Create index on created_at for ordering
CREATE INDEX IF NOT EXISTS idx_n8n_chat_history_created_at
  ON n8n_chat_history(created_at);

-- Composite index for session + time queries (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_n8n_chat_history_session_time
  ON n8n_chat_history(session_id, created_at DESC);

-- Enable RLS (optional - depends on your security requirements)
-- ALTER TABLE n8n_chat_history ENABLE ROW LEVEL SECURITY;

-- Grant access to service role (for WhatsApp service)
-- GRANT ALL ON n8n_chat_history TO service_role;

COMMENT ON TABLE n8n_chat_history IS
  'Shared conversation history for all chatbots. Session key format: {chatbotId}_{phoneNumber}. Compatible with n8n Postgres Chat Memory node.';

COMMENT ON COLUMN n8n_chat_history.session_id IS
  'Composite key: chatbot UUID + underscore + phone number (e.g., abc123_60123456789)';

COMMENT ON COLUMN n8n_chat_history.message IS
  'n8n format: { type: "human" or "ai", data: { content: "message text" } }';
