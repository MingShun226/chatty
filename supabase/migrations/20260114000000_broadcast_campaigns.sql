-- Broadcast Campaigns System
-- Allows sending promotional messages to contacts who have messaged the chatbot

-- Message Templates Table
CREATE TABLE IF NOT EXISTS message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  chatbot_id UUID REFERENCES avatars(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  content TEXT NOT NULL, -- Message with {{name}}, {{product}} placeholders
  category VARCHAR(50) DEFAULT 'promotional', -- promotional, notification, reminder
  is_active BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Broadcast Campaigns Table
CREATE TABLE IF NOT EXISTS broadcast_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  chatbot_id UUID REFERENCES avatars(id) ON DELETE CASCADE,
  session_id TEXT, -- WhatsApp Web session ID
  name VARCHAR(255) NOT NULL,
  message_template TEXT NOT NULL, -- The actual message with {{placeholders}}
  template_id UUID REFERENCES message_templates(id) ON DELETE SET NULL,
  recipient_count INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'draft', -- draft, scheduled, sending, paused, completed, failed, cancelled
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  messages_sent INTEGER DEFAULT 0,
  messages_failed INTEGER DEFAULT 0,
  delay_between_messages INTEGER DEFAULT 3000, -- milliseconds between each message (anti-spam)
  include_images BOOLEAN DEFAULT false,
  image_urls TEXT[], -- Array of image URLs to send with message
  error_log JSONB DEFAULT '[]', -- Array of error objects
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Broadcast Recipients Table
CREATE TABLE IF NOT EXISTS broadcast_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES broadcast_campaigns(id) ON DELETE CASCADE,
  phone_number VARCHAR(50) NOT NULL,
  contact_name VARCHAR(255),
  custom_params JSONB DEFAULT '{}', -- {{name}}: "John", {{product}}: "iPhone"
  status VARCHAR(50) DEFAULT 'pending', -- pending, sending, sent, failed, skipped
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  message_id TEXT, -- WhatsApp message ID if sent
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_message_templates_user ON message_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_message_templates_chatbot ON message_templates(chatbot_id);
CREATE INDEX IF NOT EXISTS idx_message_templates_active ON message_templates(is_active);

CREATE INDEX IF NOT EXISTS idx_broadcast_campaigns_user ON broadcast_campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_campaigns_chatbot ON broadcast_campaigns(chatbot_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_campaigns_status ON broadcast_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_broadcast_campaigns_scheduled ON broadcast_campaigns(scheduled_at);

CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_campaign ON broadcast_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_status ON broadcast_recipients(status);
CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_phone ON broadcast_recipients(phone_number);

-- Enable RLS
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_recipients ENABLE ROW LEVEL SECURITY;

-- RLS Policies for message_templates
CREATE POLICY "Users can view own templates"
  ON message_templates FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own templates"
  ON message_templates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own templates"
  ON message_templates FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own templates"
  ON message_templates FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for broadcast_campaigns
CREATE POLICY "Users can view own campaigns"
  ON broadcast_campaigns FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own campaigns"
  ON broadcast_campaigns FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own campaigns"
  ON broadcast_campaigns FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own campaigns"
  ON broadcast_campaigns FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for broadcast_recipients
CREATE POLICY "Users can view recipients of own campaigns"
  ON broadcast_recipients FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM broadcast_campaigns
      WHERE broadcast_campaigns.id = broadcast_recipients.campaign_id
      AND broadcast_campaigns.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can add recipients to own campaigns"
  ON broadcast_recipients FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM broadcast_campaigns
      WHERE broadcast_campaigns.id = broadcast_recipients.campaign_id
      AND broadcast_campaigns.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update recipients of own campaigns"
  ON broadcast_recipients FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM broadcast_campaigns
      WHERE broadcast_campaigns.id = broadcast_recipients.campaign_id
      AND broadcast_campaigns.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete recipients of own campaigns"
  ON broadcast_recipients FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM broadcast_campaigns
      WHERE broadcast_campaigns.id = broadcast_recipients.campaign_id
      AND broadcast_campaigns.user_id = auth.uid()
    )
  );

-- Service role policy for WhatsApp Web Service to update recipients
CREATE POLICY "Service role can update recipients"
  ON broadcast_recipients FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can update campaigns"
  ON broadcast_campaigns FOR ALL
  USING (auth.role() = 'service_role');

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_broadcast_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_message_templates_updated_at
  BEFORE UPDATE ON message_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_broadcast_updated_at();

CREATE TRIGGER trigger_broadcast_campaigns_updated_at
  BEFORE UPDATE ON broadcast_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION update_broadcast_updated_at();

-- Function to get contacts from conversation history
CREATE OR REPLACE FUNCTION get_chatbot_contacts(p_chatbot_id UUID, p_user_id UUID)
RETURNS TABLE (
  phone_number VARCHAR,
  message_count BIGINT,
  last_message_at TIMESTAMPTZ,
  first_message_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.phone_number,
    COUNT(*) as message_count,
    MAX(c.timestamp) as last_message_at,
    MIN(c.timestamp) as first_message_at
  FROM conversations c
  WHERE c.avatar_id = p_chatbot_id
    AND c.phone_number IS NOT NULL
    AND c.phone_number != ''
  GROUP BY c.phone_number
  ORDER BY last_message_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update campaign stats
CREATE OR REPLACE FUNCTION update_campaign_stats(p_campaign_id UUID)
RETURNS void AS $$
DECLARE
  v_sent INTEGER;
  v_failed INTEGER;
  v_total INTEGER;
BEGIN
  SELECT
    COUNT(*) FILTER (WHERE status = 'sent'),
    COUNT(*) FILTER (WHERE status = 'failed'),
    COUNT(*)
  INTO v_sent, v_failed, v_total
  FROM broadcast_recipients
  WHERE campaign_id = p_campaign_id;

  UPDATE broadcast_campaigns
  SET
    messages_sent = v_sent,
    messages_failed = v_failed,
    recipient_count = v_total,
    status = CASE
      WHEN v_sent + v_failed = v_total AND v_total > 0 THEN 'completed'
      ELSE status
    END,
    completed_at = CASE
      WHEN v_sent + v_failed = v_total AND v_total > 0 THEN NOW()
      ELSE completed_at
    END
  WHERE id = p_campaign_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_chatbot_contacts TO authenticated;
GRANT EXECUTE ON FUNCTION update_campaign_stats TO service_role;
