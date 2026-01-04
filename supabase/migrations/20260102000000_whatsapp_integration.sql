-- WhatsApp Business Cloud API Integration
-- This migration adds support for WhatsApp chatbot integration with Meta's official API

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- TABLE: whatsapp_connections
-- Stores WhatsApp Business Account connections
-- Supports multiple phone numbers per chatbot
-- =====================================================
CREATE TABLE whatsapp_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chatbot_id UUID NOT NULL REFERENCES avatars(id) ON DELETE CASCADE,

  -- Meta Account Info
  waba_id VARCHAR(255) NOT NULL, -- WhatsApp Business Account ID
  phone_number_id VARCHAR(255) NOT NULL UNIQUE, -- From Meta
  phone_number VARCHAR(20) NOT NULL, -- Display: +60123456789
  display_name VARCHAR(255),
  quality_rating VARCHAR(50), -- GREEN, YELLOW, RED

  -- Access Token (AES-256 encrypted)
  access_token_encrypted TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ, -- NULL = permanent token

  -- Webhook Configuration
  webhook_verify_token VARCHAR(255) NOT NULL,

  -- Business Profile (JSON object)
  business_profile JSONB DEFAULT '{}'::jsonb,

  -- Status
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'disconnected')),
  is_verified BOOLEAN DEFAULT false,

  -- Meta Tier Limits (messaging capacity)
  messaging_limit VARCHAR(50), -- TIER_50, TIER_250, TIER_1K, TIER_10K, TIER_100K, TIER_UNLIMITED
  messaging_limit_reset_at TIMESTAMPTZ,

  -- Metadata
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint: one chatbot can connect same phone once
  UNIQUE(chatbot_id, phone_number_id)
);

-- Indexes for performance
CREATE INDEX idx_whatsapp_connections_user_id ON whatsapp_connections(user_id);
CREATE INDEX idx_whatsapp_connections_chatbot_id ON whatsapp_connections(chatbot_id);
CREATE INDEX idx_whatsapp_connections_phone_number_id ON whatsapp_connections(phone_number_id);
CREATE INDEX idx_whatsapp_connections_status ON whatsapp_connections(status);

-- RLS Policies
ALTER TABLE whatsapp_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own WhatsApp connections"
  ON whatsapp_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own WhatsApp connections"
  ON whatsapp_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own WhatsApp connections"
  ON whatsapp_connections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own WhatsApp connections"
  ON whatsapp_connections FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- TABLE: whatsapp_message_templates
-- Pre-approved message templates from Meta
-- Required for proactive messaging (broadcasts, notifications)
-- =====================================================
CREATE TABLE whatsapp_message_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chatbot_id UUID NOT NULL REFERENCES avatars(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES whatsapp_connections(id) ON DELETE CASCADE,

  -- Template Info
  template_name VARCHAR(255) NOT NULL,
  template_id VARCHAR(255), -- Meta template ID (after approval)
  language VARCHAR(10) NOT NULL, -- en, ms, zh, etc.
  category VARCHAR(50) NOT NULL CHECK (category IN ('MARKETING', 'UTILITY', 'AUTHENTICATION')),

  -- Content (with placeholders like {{1}}, {{2}})
  template_body TEXT NOT NULL,
  header_type VARCHAR(50) CHECK (header_type IN ('TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT', 'LOCATION')),
  header_content TEXT,
  footer_text TEXT,
  buttons JSONB DEFAULT '[]'::jsonb, -- Array of button objects

  -- Parameters
  parameter_count INTEGER DEFAULT 0,
  parameter_names TEXT[], -- Friendly names for placeholders

  -- Status
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'disabled', 'deleted')),
  rejection_reason TEXT,

  -- Usage Tracking
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint: template name + language per connection
  UNIQUE(connection_id, template_name, language)
);

-- Indexes
CREATE INDEX idx_whatsapp_templates_user_id ON whatsapp_message_templates(user_id);
CREATE INDEX idx_whatsapp_templates_chatbot_id ON whatsapp_message_templates(chatbot_id);
CREATE INDEX idx_whatsapp_templates_connection_id ON whatsapp_message_templates(connection_id);
CREATE INDEX idx_whatsapp_templates_status ON whatsapp_message_templates(status);

-- RLS Policies
ALTER TABLE whatsapp_message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own WhatsApp templates"
  ON whatsapp_message_templates FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own WhatsApp templates"
  ON whatsapp_message_templates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own WhatsApp templates"
  ON whatsapp_message_templates FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own WhatsApp templates"
  ON whatsapp_message_templates FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- TABLE: whatsapp_broadcasts
-- Track template message campaigns to multiple recipients
-- =====================================================
CREATE TABLE whatsapp_broadcasts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chatbot_id UUID NOT NULL REFERENCES avatars(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES whatsapp_connections(id) ON DELETE CASCADE,
  template_id UUID REFERENCES whatsapp_message_templates(id) ON DELETE SET NULL,

  -- Campaign Info
  campaign_name VARCHAR(255) NOT NULL,
  template_name VARCHAR(255), -- Store template name in case template is deleted

  -- Recipients (imported from CSV or manually added)
  -- Format: [{phone: "+60123456789", params: {name: "John", code: "ABC123"}}]
  recipient_list JSONB NOT NULL,
  total_recipients INTEGER NOT NULL,

  -- Status
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'completed', 'failed', 'cancelled')),

  -- Scheduling
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Results Tracking
  messages_sent INTEGER DEFAULT 0,
  messages_delivered INTEGER DEFAULT 0,
  messages_read INTEGER DEFAULT 0,
  messages_failed INTEGER DEFAULT 0,
  error_log JSONB DEFAULT '[]'::jsonb, -- Array of error objects

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_whatsapp_broadcasts_user_id ON whatsapp_broadcasts(user_id);
CREATE INDEX idx_whatsapp_broadcasts_chatbot_id ON whatsapp_broadcasts(chatbot_id);
CREATE INDEX idx_whatsapp_broadcasts_connection_id ON whatsapp_broadcasts(connection_id);
CREATE INDEX idx_whatsapp_broadcasts_status ON whatsapp_broadcasts(status);
CREATE INDEX idx_whatsapp_broadcasts_scheduled_at ON whatsapp_broadcasts(scheduled_at);

-- RLS Policies
ALTER TABLE whatsapp_broadcasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own WhatsApp broadcasts"
  ON whatsapp_broadcasts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own WhatsApp broadcasts"
  ON whatsapp_broadcasts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own WhatsApp broadcasts"
  ON whatsapp_broadcasts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own WhatsApp broadcasts"
  ON whatsapp_broadcasts FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- TABLE: whatsapp_messages
-- All messages (sent & received) with detailed tracking
-- =====================================================
CREATE TABLE whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  connection_id UUID NOT NULL REFERENCES whatsapp_connections(id) ON DELETE CASCADE,
  chatbot_id UUID NOT NULL REFERENCES avatars(id) ON DELETE CASCADE,
  broadcast_id UUID REFERENCES whatsapp_broadcasts(id) ON DELETE SET NULL,

  -- Message IDs
  whatsapp_message_id VARCHAR(255) NOT NULL UNIQUE, -- wamid.xxx from Meta
  conversation_id VARCHAR(255), -- Meta conversation ID for billing/context

  -- Participants
  from_phone VARCHAR(20) NOT NULL,
  to_phone VARCHAR(20) NOT NULL,
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('inbound', 'outbound')),

  -- Content
  message_type VARCHAR(50) NOT NULL CHECK (message_type IN ('text', 'image', 'video', 'document', 'audio', 'location', 'contacts', 'template', 'interactive', 'reaction', 'sticker')),
  content TEXT, -- Message text or caption
  media_url TEXT, -- Public URL after downloading from Meta
  media_id VARCHAR(255), -- Meta media ID
  media_mime_type VARCHAR(100),
  media_filename VARCHAR(255),

  -- Template (for outbound template messages)
  template_name VARCHAR(255),
  template_parameters JSONB,

  -- Reply Context
  context_message_id VARCHAR(255), -- If this is a reply to another message

  -- Status (for outbound messages)
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
  error_code VARCHAR(50),
  error_message TEXT,

  -- Timestamps
  timestamp TIMESTAMPTZ NOT NULL, -- When message was created
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,

  -- Debug (store raw webhook data for troubleshooting)
  raw_webhook_data JSONB,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_whatsapp_messages_connection_id ON whatsapp_messages(connection_id);
CREATE INDEX idx_whatsapp_messages_chatbot_id ON whatsapp_messages(chatbot_id);
CREATE INDEX idx_whatsapp_messages_from_phone ON whatsapp_messages(from_phone);
CREATE INDEX idx_whatsapp_messages_to_phone ON whatsapp_messages(to_phone);
CREATE INDEX idx_whatsapp_messages_timestamp ON whatsapp_messages(timestamp DESC);
CREATE INDEX idx_whatsapp_messages_conversation_id ON whatsapp_messages(conversation_id);
CREATE INDEX idx_whatsapp_messages_direction ON whatsapp_messages(direction);
CREATE INDEX idx_whatsapp_messages_status ON whatsapp_messages(status);

-- RLS Policies
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages for their connections"
  ON whatsapp_messages FOR SELECT
  USING (
    connection_id IN (
      SELECT id FROM whatsapp_connections WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert messages for their connections"
  ON whatsapp_messages FOR INSERT
  WITH CHECK (
    connection_id IN (
      SELECT id FROM whatsapp_connections WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update messages for their connections"
  ON whatsapp_messages FOR UPDATE
  USING (
    connection_id IN (
      SELECT id FROM whatsapp_connections WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- TABLE: whatsapp_product_catalogs
-- Product catalog sync with WhatsApp Commerce
-- =====================================================
CREATE TABLE whatsapp_product_catalogs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chatbot_id UUID NOT NULL REFERENCES avatars(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES whatsapp_connections(id) ON DELETE CASCADE,

  -- Meta Catalog
  catalog_id VARCHAR(255) NOT NULL UNIQUE, -- Meta catalog ID
  catalog_name VARCHAR(255) NOT NULL,

  -- Sync Configuration
  auto_sync BOOLEAN DEFAULT false,
  last_sync_at TIMESTAMPTZ,
  sync_status VARCHAR(50) DEFAULT 'pending' CHECK (sync_status IN ('pending', 'syncing', 'completed', 'failed')),

  -- Sync Stats
  total_products INTEGER DEFAULT 0,
  synced_products INTEGER DEFAULT 0,
  failed_products INTEGER DEFAULT 0,
  sync_errors JSONB DEFAULT '[]'::jsonb, -- Array of error objects

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_whatsapp_catalogs_user_id ON whatsapp_product_catalogs(user_id);
CREATE INDEX idx_whatsapp_catalogs_chatbot_id ON whatsapp_product_catalogs(chatbot_id);
CREATE INDEX idx_whatsapp_catalogs_connection_id ON whatsapp_product_catalogs(connection_id);

-- RLS Policies
ALTER TABLE whatsapp_product_catalogs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own WhatsApp catalogs"
  ON whatsapp_product_catalogs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own WhatsApp catalogs"
  ON whatsapp_product_catalogs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own WhatsApp catalogs"
  ON whatsapp_product_catalogs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own WhatsApp catalogs"
  ON whatsapp_product_catalogs FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- EXTEND EXISTING TABLE: conversations
-- Add WhatsApp-specific columns for compatibility
-- =====================================================
ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS whatsapp_message_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS whatsapp_connection_id UUID REFERENCES whatsapp_connections(id) ON DELETE SET NULL;

-- Index for WhatsApp queries
CREATE INDEX IF NOT EXISTS idx_conversations_whatsapp_connection ON conversations(whatsapp_connection_id);
CREATE INDEX IF NOT EXISTS idx_conversations_whatsapp_message_id ON conversations(whatsapp_message_id);

-- =====================================================
-- FUNCTIONS
-- Helper functions for WhatsApp integration
-- =====================================================

-- Function to update whatsapp_connections.updated_at on row update
CREATE OR REPLACE FUNCTION update_whatsapp_connection_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_whatsapp_connection_updated_at
  BEFORE UPDATE ON whatsapp_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_whatsapp_connection_updated_at();

-- Function to update whatsapp_message_templates.updated_at on row update
CREATE OR REPLACE FUNCTION update_whatsapp_template_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_whatsapp_template_updated_at
  BEFORE UPDATE ON whatsapp_message_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_whatsapp_template_updated_at();

-- Function to update whatsapp_broadcasts.updated_at on row update
CREATE OR REPLACE FUNCTION update_whatsapp_broadcast_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_whatsapp_broadcast_updated_at
  BEFORE UPDATE ON whatsapp_broadcasts
  FOR EACH ROW
  EXECUTE FUNCTION update_whatsapp_broadcast_updated_at();

-- Function to update whatsapp_product_catalogs.updated_at on row update
CREATE OR REPLACE FUNCTION update_whatsapp_catalog_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_whatsapp_catalog_updated_at
  BEFORE UPDATE ON whatsapp_product_catalogs
  FOR EACH ROW
  EXECUTE FUNCTION update_whatsapp_catalog_updated_at();

-- =====================================================
-- COMMENTS
-- Documentation for tables and columns
-- =====================================================

COMMENT ON TABLE whatsapp_connections IS 'WhatsApp Business Account connections - supports multiple phone numbers per chatbot';
COMMENT ON COLUMN whatsapp_connections.waba_id IS 'WhatsApp Business Account ID from Meta';
COMMENT ON COLUMN whatsapp_connections.phone_number_id IS 'Phone Number ID from Meta - unique identifier';
COMMENT ON COLUMN whatsapp_connections.access_token_encrypted IS 'Meta access token encrypted with AES-256-GCM';
COMMENT ON COLUMN whatsapp_connections.webhook_verify_token IS 'Random token for Meta webhook verification';
COMMENT ON COLUMN whatsapp_connections.quality_rating IS 'Phone number quality: GREEN (high), YELLOW (medium), RED (low)';
COMMENT ON COLUMN whatsapp_connections.messaging_limit IS 'Meta messaging tier limit (TIER_50 = 50 conversations/24h)';

COMMENT ON TABLE whatsapp_message_templates IS 'Pre-approved message templates for broadcasts and notifications';
COMMENT ON COLUMN whatsapp_message_templates.category IS 'MARKETING (promotions), UTILITY (account updates), AUTHENTICATION (OTP)';
COMMENT ON COLUMN whatsapp_message_templates.template_body IS 'Template text with placeholders: {{1}}, {{2}}, etc.';
COMMENT ON COLUMN whatsapp_message_templates.buttons IS 'JSONB array of button objects (call-to-action, quick reply)';

COMMENT ON TABLE whatsapp_broadcasts IS 'Broadcast campaigns to send template messages to multiple recipients';
COMMENT ON COLUMN whatsapp_broadcasts.recipient_list IS 'JSONB array of recipients with phone numbers and template parameters';
COMMENT ON COLUMN whatsapp_broadcasts.error_log IS 'JSONB array of error objects for failed messages';

COMMENT ON TABLE whatsapp_messages IS 'All WhatsApp messages (inbound and outbound) with delivery tracking';
COMMENT ON COLUMN whatsapp_messages.whatsapp_message_id IS 'Meta message ID (wamid.xxx) - unique across WhatsApp';
COMMENT ON COLUMN whatsapp_messages.conversation_id IS 'Meta conversation ID for billing and context tracking';
COMMENT ON COLUMN whatsapp_messages.direction IS 'inbound (received from user) or outbound (sent by chatbot)';
COMMENT ON COLUMN whatsapp_messages.raw_webhook_data IS 'Full webhook payload from Meta for debugging';

COMMENT ON TABLE whatsapp_product_catalogs IS 'Product catalog sync tracking with WhatsApp Commerce';
COMMENT ON COLUMN whatsapp_product_catalogs.catalog_id IS 'Meta catalog ID after creation';
COMMENT ON COLUMN whatsapp_product_catalogs.auto_sync IS 'Automatically sync products when chatbot_products table is updated';
