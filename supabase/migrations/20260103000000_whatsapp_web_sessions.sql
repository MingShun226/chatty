-- WhatsApp Web Sessions Table
-- Stores session data for unofficial WhatsApp Web connections

CREATE TABLE IF NOT EXISTS whatsapp_web_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chatbot_id UUID NOT NULL REFERENCES avatars(id) ON DELETE CASCADE,

  -- Session identification
  phone_number TEXT, -- Will be populated after QR scan
  session_id TEXT UNIQUE NOT NULL, -- Unique identifier for this session

  -- Session data (encrypted auth credentials)
  session_data JSONB NOT NULL DEFAULT '{}',

  -- Connection status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'qr_ready', 'connecting', 'connected', 'disconnected', 'failed')),
  qr_code TEXT, -- Base64 encoded QR code image
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

-- Enable RLS
ALTER TABLE whatsapp_web_sessions ENABLE ROW LEVEL SECURITY;

-- Policies
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

-- Indexes
CREATE INDEX idx_whatsapp_web_sessions_user ON whatsapp_web_sessions(user_id);
CREATE INDEX idx_whatsapp_web_sessions_chatbot ON whatsapp_web_sessions(chatbot_id);
CREATE INDEX idx_whatsapp_web_sessions_status ON whatsapp_web_sessions(status);
CREATE INDEX idx_whatsapp_web_sessions_session_id ON whatsapp_web_sessions(session_id);

-- Updated at trigger
CREATE TRIGGER update_whatsapp_web_sessions_updated_at
  BEFORE UPDATE ON whatsapp_web_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- WhatsApp Web Messages Table (separate from official API messages)
CREATE TABLE IF NOT EXISTS whatsapp_web_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES whatsapp_web_sessions(id) ON DELETE CASCADE,
  chatbot_id UUID NOT NULL REFERENCES avatars(id) ON DELETE CASCADE,

  -- Message details
  message_id TEXT NOT NULL, -- WhatsApp message ID
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
ALTER TABLE whatsapp_web_messages ENABLE ROW LEVEL SECURITY;

-- Policies
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
  WITH CHECK (true); -- Edge functions will use service role

-- Indexes
CREATE INDEX idx_whatsapp_web_messages_session ON whatsapp_web_messages(session_id);
CREATE INDEX idx_whatsapp_web_messages_chatbot ON whatsapp_web_messages(chatbot_id);
CREATE INDEX idx_whatsapp_web_messages_from ON whatsapp_web_messages(from_number);
CREATE INDEX idx_whatsapp_web_messages_timestamp ON whatsapp_web_messages(timestamp DESC);
