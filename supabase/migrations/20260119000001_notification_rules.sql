-- Dynamic Notification Rules System
-- Allows users to create custom notification rules beyond the 4 system defaults

-- Create notification_rules table
CREATE TABLE IF NOT EXISTS notification_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chatbot_id UUID REFERENCES avatars(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Rule definition
  rule_key TEXT NOT NULL,              -- e.g., 'purchase_intent', 'urgent_complaint'
  display_name TEXT NOT NULL,          -- e.g., 'Customer wants to buy'
  description TEXT,                    -- e.g., 'Triggered when customer shows buying signals'
  keywords TEXT[] NOT NULL DEFAULT '{}', -- e.g., ['want to buy', 'how to order']

  -- Rule settings
  is_enabled BOOLEAN DEFAULT true,
  is_system BOOLEAN DEFAULT false,     -- true = default 4 rules (cannot be deleted)
  priority INT DEFAULT 0,              -- higher priority rules are checked first

  -- Notification customization
  emoji TEXT DEFAULT '🔔',             -- emoji shown in notification
  alert_message TEXT,                  -- custom alert message (optional)

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  UNIQUE(chatbot_id, rule_key)
);

-- Create index for faster lookups
CREATE INDEX idx_notification_rules_chatbot ON notification_rules(chatbot_id);
CREATE INDEX idx_notification_rules_enabled ON notification_rules(chatbot_id, is_enabled) WHERE is_enabled = true;

-- Enable RLS
ALTER TABLE notification_rules ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own notification rules"
  ON notification_rules FOR SELECT
  USING (
    user_id = auth.uid() OR
    chatbot_id IN (SELECT id FROM avatars WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can create own notification rules"
  ON notification_rules FOR INSERT
  WITH CHECK (
    user_id = auth.uid() OR
    chatbot_id IN (SELECT id FROM avatars WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update own notification rules"
  ON notification_rules FOR UPDATE
  USING (
    user_id = auth.uid() OR
    chatbot_id IN (SELECT id FROM avatars WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can delete own custom notification rules"
  ON notification_rules FOR DELETE
  USING (
    (user_id = auth.uid() OR chatbot_id IN (SELECT id FROM avatars WHERE user_id = auth.uid()))
    AND is_system = false  -- Cannot delete system rules
  );

-- Function to initialize default system rules for a chatbot
CREATE OR REPLACE FUNCTION initialize_notification_rules(p_chatbot_id UUID, p_user_id UUID)
RETURNS void AS $$
BEGIN
  -- Insert system rules if they don't exist
  INSERT INTO notification_rules (chatbot_id, user_id, rule_key, display_name, description, keywords, is_system, emoji, priority)
  VALUES
    (p_chatbot_id, p_user_id, 'purchase_intent', 'Customer wants to buy',
     'Triggered when customer shows buying signals like "I want to buy", "how to order"',
     ARRAY['want to buy', 'how to order', 'ready to purchase', 'take my order', 'checkout', 'i''ll buy it', 'i want to order', 'how do i pay', 'nak beli', 'macam mana nak order'],
     true, '🛒', 100),

    (p_chatbot_id, p_user_id, 'human_agent', 'Customer wants human agent',
     'Triggered when customer requests to speak with a real person',
     ARRAY['speak to human', 'talk to agent', 'real person', 'customer service', 'live support', 'speak to someone', 'talk to real', 'human please', 'actual person', 'nak cakap dengan orang'],
     true, '👤', 90),

    (p_chatbot_id, p_user_id, 'price_inquiry', 'Customer asks about price',
     'Triggered when customer inquires about pricing (useful when prices are hidden)',
     ARRAY['how much', 'what''s the price', 'berapa harga', 'price', 'cost', 'fee', 'rate', 'pricing', 'budget', 'quotation', 'quote', 'harga'],
     true, '💰', 80),

    (p_chatbot_id, p_user_id, 'ai_unsure', 'AI is unsure how to respond',
     'Triggered when AI cannot confidently answer or customer asks unusual questions',
     ARRAY[],  -- This is detected by AI behavior, not keywords
     true, '❓', 70)
  ON CONFLICT (chatbot_id, rule_key) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get notification rules for a chatbot (including inherited system defaults)
CREATE OR REPLACE FUNCTION get_notification_rules(p_chatbot_id UUID)
RETURNS TABLE (
  id UUID,
  rule_key TEXT,
  display_name TEXT,
  description TEXT,
  keywords TEXT[],
  is_enabled BOOLEAN,
  is_system BOOLEAN,
  emoji TEXT,
  priority INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    nr.id,
    nr.rule_key,
    nr.display_name,
    nr.description,
    nr.keywords,
    nr.is_enabled,
    nr.is_system,
    nr.emoji,
    nr.priority
  FROM notification_rules nr
  WHERE nr.chatbot_id = p_chatbot_id
  ORDER BY nr.priority DESC, nr.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_notification_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notification_rules_updated_at
  BEFORE UPDATE ON notification_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_rules_updated_at();

-- Add comments
COMMENT ON TABLE notification_rules IS 'Stores notification rules for chatbots - both system defaults and user-defined custom rules';
COMMENT ON COLUMN notification_rules.rule_key IS 'Unique identifier for the rule within a chatbot (e.g., purchase_intent, urgent_complaint)';
COMMENT ON COLUMN notification_rules.is_system IS 'True for the 4 default system rules, false for user-created custom rules';
COMMENT ON COLUMN notification_rules.keywords IS 'Array of keywords/phrases that trigger this rule';
