-- Smart Follow-Up System with AI Tagging
-- Enables automatic contact tagging and intelligent follow-ups

-- Contact profiles with AI-assigned tags
CREATE TABLE IF NOT EXISTS contact_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  chatbot_id UUID REFERENCES avatars(id) ON DELETE CASCADE,
  session_id TEXT, -- WhatsApp session for sending
  phone_number VARCHAR(50) NOT NULL,
  contact_name VARCHAR(255),

  -- AI-assigned tags (array of tag strings)
  tags TEXT[] DEFAULT '{}',
  primary_tag VARCHAR(50), -- Main classification

  -- Conversation state
  last_message_at TIMESTAMPTZ,
  last_message_role VARCHAR(20), -- 'user' or 'assistant'
  message_count INTEGER DEFAULT 0,

  -- Follow-up tracking
  auto_followup_enabled BOOLEAN DEFAULT true,
  followup_due_at TIMESTAMPTZ,
  last_followup_at TIMESTAMPTZ,
  followup_count INTEGER DEFAULT 0,

  -- AI analysis
  ai_summary TEXT, -- Brief summary of conversation state
  ai_sentiment VARCHAR(20), -- positive, neutral, negative
  ai_analysis JSONB, -- Full analysis JSON
  analyzed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(chatbot_id, phone_number)
);

-- Follow-up history log
CREATE TABLE IF NOT EXISTS followup_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contact_profiles(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  chatbot_id UUID REFERENCES avatars(id) ON DELETE CASCADE,
  trigger_type VARCHAR(20) NOT NULL, -- 'auto' or 'manual'
  trigger_tag VARCHAR(50), -- Which tag triggered this
  message_sent TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  response_received BOOLEAN DEFAULT false,
  response_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tag definitions (customizable per chatbot)
CREATE TABLE IF NOT EXISTS followup_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  chatbot_id UUID REFERENCES avatars(id) ON DELETE CASCADE,
  tag_name VARCHAR(50) NOT NULL,
  description TEXT,
  color VARCHAR(20) DEFAULT '#6b7280', -- For UI display (gray default)
  auto_followup BOOLEAN DEFAULT false,
  followup_delay_hours INTEGER DEFAULT 24,
  followup_template TEXT, -- Optional default template
  is_system BOOLEAN DEFAULT false, -- System tags can't be deleted
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(chatbot_id, tag_name)
);

-- Settings per chatbot
CREATE TABLE IF NOT EXISTS followup_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  chatbot_id UUID REFERENCES avatars(id) ON DELETE CASCADE UNIQUE,
  auto_tagging_enabled BOOLEAN DEFAULT true,
  auto_followup_enabled BOOLEAN DEFAULT true,
  business_hours_only BOOLEAN DEFAULT true,
  start_hour INTEGER DEFAULT 9,
  end_hour INTEGER DEFAULT 21,
  max_followups_per_contact INTEGER DEFAULT 3,
  ai_model VARCHAR(50) DEFAULT 'gpt-4o-mini', -- AI model for analysis
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_contact_profiles_chatbot ON contact_profiles(chatbot_id);
CREATE INDEX IF NOT EXISTS idx_contact_profiles_user ON contact_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_contact_profiles_phone ON contact_profiles(phone_number);
CREATE INDEX IF NOT EXISTS idx_contact_profiles_primary_tag ON contact_profiles(primary_tag);
CREATE INDEX IF NOT EXISTS idx_contact_profiles_tags ON contact_profiles USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_contact_profiles_followup_due ON contact_profiles(followup_due_at) WHERE followup_due_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contact_profiles_sentiment ON contact_profiles(ai_sentiment);

CREATE INDEX IF NOT EXISTS idx_followup_history_contact ON followup_history(contact_id);
CREATE INDEX IF NOT EXISTS idx_followup_history_chatbot ON followup_history(chatbot_id);
CREATE INDEX IF NOT EXISTS idx_followup_history_sent_at ON followup_history(sent_at);
CREATE INDEX IF NOT EXISTS idx_followup_history_trigger_type ON followup_history(trigger_type);

CREATE INDEX IF NOT EXISTS idx_followup_tags_chatbot ON followup_tags(chatbot_id);
CREATE INDEX IF NOT EXISTS idx_followup_tags_name ON followup_tags(tag_name);

-- Enable RLS
ALTER TABLE contact_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE followup_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE followup_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE followup_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for contact_profiles
CREATE POLICY "Users can view own contact profiles"
  ON contact_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own contact profiles"
  ON contact_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own contact profiles"
  ON contact_profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own contact profiles"
  ON contact_profiles FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for followup_history
CREATE POLICY "Users can view own followup history"
  ON followup_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own followup history"
  ON followup_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own followup history"
  ON followup_history FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for followup_tags
CREATE POLICY "Users can view own followup tags"
  ON followup_tags FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own followup tags"
  ON followup_tags FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own followup tags"
  ON followup_tags FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own followup tags"
  ON followup_tags FOR DELETE
  USING (auth.uid() = user_id AND is_system = false);

-- RLS Policies for followup_settings
CREATE POLICY "Users can view own followup settings"
  ON followup_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own followup settings"
  ON followup_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own followup settings"
  ON followup_settings FOR UPDATE
  USING (auth.uid() = user_id);

-- Service role policies for WhatsApp Web Service
CREATE POLICY "Service role can manage contact profiles"
  ON contact_profiles FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage followup history"
  ON followup_history FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage followup tags"
  ON followup_tags FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage followup settings"
  ON followup_settings FOR ALL
  USING (auth.role() = 'service_role');

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_followup_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_contact_profiles_updated_at
  BEFORE UPDATE ON contact_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_followup_updated_at();

CREATE TRIGGER trigger_followup_tags_updated_at
  BEFORE UPDATE ON followup_tags
  FOR EACH ROW
  EXECUTE FUNCTION update_followup_updated_at();

CREATE TRIGGER trigger_followup_settings_updated_at
  BEFORE UPDATE ON followup_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_followup_updated_at();

-- Function to get contacts due for follow-up
CREATE OR REPLACE FUNCTION get_due_followups(p_chatbot_id UUID)
RETURNS TABLE (
  contact_id UUID,
  phone_number VARCHAR,
  contact_name VARCHAR,
  primary_tag VARCHAR,
  tags TEXT[],
  ai_summary TEXT,
  followup_count INTEGER,
  last_message_at TIMESTAMPTZ,
  session_id TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cp.id as contact_id,
    cp.phone_number,
    cp.contact_name,
    cp.primary_tag,
    cp.tags,
    cp.ai_summary,
    cp.followup_count,
    cp.last_message_at,
    cp.session_id
  FROM contact_profiles cp
  JOIN followup_settings fs ON fs.chatbot_id = cp.chatbot_id
  WHERE cp.chatbot_id = p_chatbot_id
    AND cp.auto_followup_enabled = true
    AND cp.followup_due_at IS NOT NULL
    AND cp.followup_due_at <= NOW()
    AND cp.followup_count < fs.max_followups_per_contact
    AND fs.auto_followup_enabled = true
  ORDER BY cp.followup_due_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get contact stats by tag
CREATE OR REPLACE FUNCTION get_contact_stats_by_tag(p_chatbot_id UUID)
RETURNS TABLE (
  tag_name TEXT,
  contact_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    unnest(cp.tags) as tag_name,
    COUNT(*) as contact_count
  FROM contact_profiles cp
  WHERE cp.chatbot_id = p_chatbot_id
  GROUP BY unnest(cp.tags)
  ORDER BY contact_count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to initialize default system tags for a chatbot (simplified 5 tags)
CREATE OR REPLACE FUNCTION initialize_default_tags(p_chatbot_id UUID, p_user_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO followup_tags (chatbot_id, user_id, tag_name, description, color, auto_followup, followup_delay_hours, is_system)
  VALUES
    (p_chatbot_id, p_user_id, 'hot_lead', 'High interest, likely to convert', '#f59e0b', true, 24, true),
    (p_chatbot_id, p_user_id, 'new_lead', 'First-time inquiry, getting information', '#3b82f6', true, 48, true),
    (p_chatbot_id, p_user_id, 'customer', 'Already purchased or existing customer', '#10b981', false, 0, true),
    (p_chatbot_id, p_user_id, 'needs_help', 'Has questions or issues to resolve', '#ef4444', true, 24, true),
    (p_chatbot_id, p_user_id, 'inactive', 'Conversation went cold, no engagement', '#6b7280', false, 0, true)
  ON CONFLICT (chatbot_id, tag_name) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_due_followups TO authenticated;
GRANT EXECUTE ON FUNCTION get_due_followups TO service_role;
GRANT EXECUTE ON FUNCTION get_contact_stats_by_tag TO authenticated;
GRANT EXECUTE ON FUNCTION initialize_default_tags TO authenticated;
GRANT EXECUTE ON FUNCTION initialize_default_tags TO service_role;
