-- Auto-create notification rules when a chatbot is created
-- And populate existing chatbots with default rules

-- Trigger function to auto-create default notification rules for new chatbots
CREATE OR REPLACE FUNCTION auto_create_notification_rules()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert the 4 default system rules for the new chatbot
  INSERT INTO notification_rules (chatbot_id, user_id, rule_key, display_name, description, keywords, is_system, emoji, priority)
  VALUES
    (NEW.id, NEW.user_id, 'purchase_intent', 'Customer wants to buy',
     'Triggered when customer shows buying signals',
     ARRAY['want to buy', 'how to order', 'ready to purchase', 'take my order', 'checkout', 'i''ll buy it', 'i want to order', 'how do i pay', 'nak beli', 'macam mana nak order'],
     true, '🛒', 100),

    (NEW.id, NEW.user_id, 'human_agent', 'Customer wants human agent',
     'Triggered when customer requests to speak with a real person',
     ARRAY['speak to human', 'talk to agent', 'real person', 'customer service', 'live support', 'speak to someone', 'talk to real', 'human please', 'actual person', 'nak cakap dengan orang'],
     true, '👤', 90),

    (NEW.id, NEW.user_id, 'price_inquiry', 'Customer asks about price',
     'Triggered when customer inquires about pricing',
     ARRAY['how much', 'what''s the price', 'berapa harga', 'price', 'cost', 'fee', 'rate', 'pricing', 'budget', 'quotation', 'quote', 'harga'],
     true, '💰', 80),

    (NEW.id, NEW.user_id, 'ai_unsure', 'AI is unsure how to respond',
     'Triggered when AI cannot confidently answer',
     ARRAY[],
     true, '❓', 70)
  ON CONFLICT (chatbot_id, rule_key) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on avatars table
DROP TRIGGER IF EXISTS create_notification_rules_on_chatbot ON avatars;
CREATE TRIGGER create_notification_rules_on_chatbot
  AFTER INSERT ON avatars
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_notification_rules();

-- Populate existing chatbots with default notification rules
-- This is a one-time migration for chatbots that already exist
INSERT INTO notification_rules (chatbot_id, user_id, rule_key, display_name, description, keywords, is_system, emoji, priority)
SELECT
  a.id as chatbot_id,
  a.user_id,
  r.rule_key,
  r.display_name,
  r.description,
  r.keywords,
  true as is_system,
  r.emoji,
  r.priority
FROM avatars a
CROSS JOIN (
  VALUES
    ('purchase_intent', 'Customer wants to buy', 'Triggered when customer shows buying signals',
     ARRAY['want to buy', 'how to order', 'ready to purchase', 'take my order', 'checkout', 'i''ll buy it', 'i want to order', 'how do i pay', 'nak beli', 'macam mana nak order'],
     '🛒', 100),
    ('human_agent', 'Customer wants human agent', 'Triggered when customer requests to speak with a real person',
     ARRAY['speak to human', 'talk to agent', 'real person', 'customer service', 'live support', 'speak to someone', 'talk to real', 'human please', 'actual person', 'nak cakap dengan orang'],
     '👤', 90),
    ('price_inquiry', 'Customer asks about price', 'Triggered when customer inquires about pricing',
     ARRAY['how much', 'what''s the price', 'berapa harga', 'price', 'cost', 'fee', 'rate', 'pricing', 'budget', 'quotation', 'quote', 'harga'],
     '💰', 80),
    ('ai_unsure', 'AI is unsure how to respond', 'Triggered when AI cannot confidently answer',
     ARRAY[]::text[],
     '❓', 70)
) AS r(rule_key, display_name, description, keywords, emoji, priority)
ON CONFLICT (chatbot_id, rule_key) DO NOTHING;

-- Add comment
COMMENT ON FUNCTION auto_create_notification_rules() IS 'Automatically creates default notification rules when a new chatbot is created';
