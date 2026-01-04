-- ==================================================
-- WhatsApp Web Integration - SAFE Database Setup
-- ==================================================
-- This version can be re-run safely - it drops existing objects first
-- INSTRUCTIONS:
-- 1. Go to: https://supabase.com/dashboard/project/xatrtqdgghanwdujyhkq/sql/new
-- 2. Copy this ENTIRE file
-- 3. Paste into the SQL editor
-- 4. Click "Run" button
-- ==================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own sessions" ON whatsapp_web_sessions;
DROP POLICY IF EXISTS "Users can create own sessions" ON whatsapp_web_sessions;
DROP POLICY IF EXISTS "Users can update own sessions" ON whatsapp_web_sessions;
DROP POLICY IF EXISTS "Users can delete own sessions" ON whatsapp_web_sessions;
DROP POLICY IF EXISTS "Users can view messages from own sessions" ON whatsapp_web_messages;
DROP POLICY IF EXISTS "System can insert messages" ON whatsapp_web_messages;

-- Drop existing tables if they exist (careful - this deletes data!)
-- Comment out these lines if you want to preserve existing data
-- DROP TABLE IF EXISTS whatsapp_web_messages CASCADE;
-- DROP TABLE IF EXISTS whatsapp_web_sessions CASCADE;

-- WhatsApp Web Sessions Table
CREATE TABLE IF NOT EXISTS whatsapp_web_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chatbot_id UUID NOT NULL REFERENCES avatars(id) ON DELETE CASCADE,

  -- Session identification
  phone_number TEXT,
  session_id TEXT UNIQUE NOT NULL,

  -- Session data
  session_data JSONB NOT NULL DEFAULT '{}',

  -- Connection status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'qr_ready', 'connecting', 'connected', 'disconnected', 'failed')),
  qr_code TEXT,
  qr_expires_at TIMESTAMPTZ,

  -- Metadata
  connected_at TIMESTAMPTZ,
  last_active_at TIMESTAMPTZ,
  disconnect_reason TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  UNIQUE(user_id, chatbot_id)
);

-- WhatsApp Web Messages Table
CREATE TABLE IF NOT EXISTS whatsapp_web_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES whatsapp_web_sessions(id) ON DELETE CASCADE,
  chatbot_id UUID NOT NULL REFERENCES avatars(id) ON DELETE CASCADE,

  -- Message details
  message_id TEXT NOT NULL,
  from_number TEXT NOT NULL,
  to_number TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),

  -- Content
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'video', 'audio', 'document', 'sticker')),
  content TEXT,
  media_url TEXT,

  -- Status
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read', 'failed')),
  error_message TEXT,

  -- Timestamps
  timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(session_id, message_id)
);

-- Enable RLS
ALTER TABLE whatsapp_web_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_web_messages ENABLE ROW LEVEL SECURITY;

-- Create Policies
CREATE POLICY "Users can view own sessions"
  ON whatsapp_web_sessions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own sessions"
  ON whatsapp_web_sessions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
  ON whatsapp_web_sessions
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions"
  ON whatsapp_web_sessions
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view messages from own sessions"
  ON whatsapp_web_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM whatsapp_web_sessions
      WHERE whatsapp_web_sessions.id = whatsapp_web_messages.session_id
      AND whatsapp_web_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert messages"
  ON whatsapp_web_messages
  FOR INSERT
  WITH CHECK (true);

-- Create Indexes
CREATE INDEX IF NOT EXISTS idx_whatsapp_web_sessions_user ON whatsapp_web_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_web_sessions_chatbot ON whatsapp_web_sessions(chatbot_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_web_sessions_status ON whatsapp_web_sessions(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_web_sessions_session_id ON whatsapp_web_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_web_messages_session ON whatsapp_web_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_web_messages_chatbot ON whatsapp_web_messages(chatbot_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_web_messages_from ON whatsapp_web_messages(from_number);
CREATE INDEX IF NOT EXISTS idx_whatsapp_web_messages_timestamp ON whatsapp_web_messages(timestamp DESC);

-- Create trigger (only if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_whatsapp_web_sessions_updated_at'
  ) THEN
    CREATE TRIGGER update_whatsapp_web_sessions_updated_at
      BEFORE UPDATE ON whatsapp_web_sessions
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ==================================================
-- DONE!
-- You should see "Success. No rows returned"
-- ==================================================
