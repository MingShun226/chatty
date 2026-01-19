-- ====================================================
-- CHATBOT MESSAGE TRACKING
-- Track message usage per chatbot per month for subscription tiers
-- Free: 100 messages/month, Pro: 1000 messages/month
-- ====================================================

-- Table to track message usage per chatbot per month
CREATE TABLE IF NOT EXISTS chatbot_message_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chatbot_id UUID NOT NULL REFERENCES avatars(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_month DATE NOT NULL DEFAULT DATE_TRUNC('month', CURRENT_DATE),
  message_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(chatbot_id, usage_month)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_chatbot_message_usage_chatbot
  ON chatbot_message_usage(chatbot_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_message_usage_user
  ON chatbot_message_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_message_usage_month
  ON chatbot_message_usage(usage_month DESC);
CREATE INDEX IF NOT EXISTS idx_chatbot_message_usage_chatbot_month
  ON chatbot_message_usage(chatbot_id, usage_month DESC);

-- Enable RLS
ALTER TABLE chatbot_message_usage ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own chatbot usage
CREATE POLICY "Users can view own chatbot message usage"
  ON chatbot_message_usage FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Service role can insert/update (for whatsapp-web-service)
CREATE POLICY "Service can manage message usage"
  ON chatbot_message_usage FOR ALL
  USING (true)
  WITH CHECK (true);

-- Function to increment message count for a chatbot
CREATE OR REPLACE FUNCTION increment_chatbot_message_count(
  p_chatbot_id UUID,
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE(
  current_count INTEGER,
  monthly_limit INTEGER,
  is_over_limit BOOLEAN
) AS $$
DECLARE
  v_current_month DATE := DATE_TRUNC('month', CURRENT_DATE);
  v_user_id UUID;
  v_current_count INTEGER;
  v_tier_id UUID;
  v_monthly_limit INTEGER;
BEGIN
  -- Get user_id from chatbot if not provided
  IF p_user_id IS NULL THEN
    SELECT user_id INTO v_user_id FROM avatars WHERE id = p_chatbot_id;
  ELSE
    v_user_id := p_user_id;
  END IF;

  -- Upsert the usage record and increment count
  INSERT INTO chatbot_message_usage (chatbot_id, user_id, usage_month, message_count, last_message_at)
  VALUES (p_chatbot_id, v_user_id, v_current_month, 1, NOW())
  ON CONFLICT (chatbot_id, usage_month)
  DO UPDATE SET
    message_count = chatbot_message_usage.message_count + 1,
    last_message_at = NOW(),
    updated_at = NOW()
  RETURNING chatbot_message_usage.message_count INTO v_current_count;

  -- Get user's subscription and tier message limit
  SELECT COALESCE(
    (us.custom_limits->>'monthly_messages')::INTEGER,
    st.max_messages,
    100
  ) INTO v_monthly_limit
  FROM user_subscriptions us
  LEFT JOIN subscription_tiers st ON st.id = us.tier_id
  WHERE us.user_id = v_user_id AND us.status = 'active';

  -- If no tier found, default to 100
  IF v_monthly_limit IS NULL THEN
    v_monthly_limit := 100;
  END IF;

  -- Handle unlimited (-1 means no limit, use a very large number)
  IF v_monthly_limit = -1 THEN
    v_monthly_limit := 999999999;
  END IF;

  RETURN QUERY SELECT
    v_current_count,
    v_monthly_limit,
    v_current_count > v_monthly_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get chatbot message usage
CREATE OR REPLACE FUNCTION get_chatbot_message_usage(p_chatbot_id UUID)
RETURNS TABLE(
  current_count INTEGER,
  monthly_limit INTEGER,
  is_over_limit BOOLEAN,
  usage_percentage NUMERIC,
  reset_date DATE
) AS $$
DECLARE
  v_current_month DATE := DATE_TRUNC('month', CURRENT_DATE);
  v_user_id UUID;
  v_current_count INTEGER;
  v_tier_id UUID;
  v_monthly_limit INTEGER;
BEGIN
  -- Get user_id from chatbot
  SELECT user_id INTO v_user_id FROM avatars WHERE id = p_chatbot_id;

  -- Get current message count
  SELECT COALESCE(cmu.message_count, 0) INTO v_current_count
  FROM chatbot_message_usage cmu
  WHERE cmu.chatbot_id = p_chatbot_id AND cmu.usage_month = v_current_month;

  IF v_current_count IS NULL THEN
    v_current_count := 0;
  END IF;

  -- Get user's subscription and tier message limit
  SELECT COALESCE(
    (us.custom_limits->>'monthly_messages')::INTEGER,
    st.max_messages,
    100
  ) INTO v_monthly_limit
  FROM user_subscriptions us
  LEFT JOIN subscription_tiers st ON st.id = us.tier_id
  WHERE us.user_id = v_user_id AND us.status = 'active';

  -- If no tier found, default to 100
  IF v_monthly_limit IS NULL THEN
    v_monthly_limit := 100;
  END IF;

  -- Handle unlimited (-1 means no limit, use a very large number)
  IF v_monthly_limit = -1 THEN
    v_monthly_limit := 999999999;
  END IF;

  RETURN QUERY SELECT
    v_current_count,
    v_monthly_limit,
    v_current_count >= v_monthly_limit,
    ROUND((v_current_count::NUMERIC / v_monthly_limit::NUMERIC) * 100, 1),
    (v_current_month + INTERVAL '1 month')::DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if chatbot can send messages (not over limit)
CREATE OR REPLACE FUNCTION can_chatbot_send_message(p_chatbot_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_month DATE := DATE_TRUNC('month', CURRENT_DATE);
  v_user_id UUID;
  v_current_count INTEGER;
  v_tier_id UUID;
  v_monthly_limit INTEGER;
BEGIN
  -- Get user_id from chatbot
  SELECT user_id INTO v_user_id FROM avatars WHERE id = p_chatbot_id;

  -- Get current message count
  SELECT COALESCE(cmu.message_count, 0) INTO v_current_count
  FROM chatbot_message_usage cmu
  WHERE cmu.chatbot_id = p_chatbot_id AND cmu.usage_month = v_current_month;

  IF v_current_count IS NULL THEN
    v_current_count := 0;
  END IF;

  -- Get user's subscription and tier message limit
  SELECT COALESCE(
    (us.custom_limits->>'monthly_messages')::INTEGER,
    st.max_messages,
    100
  ) INTO v_monthly_limit
  FROM user_subscriptions us
  LEFT JOIN subscription_tiers st ON st.id = us.tier_id
  WHERE us.user_id = v_user_id AND us.status = 'active';

  -- If no tier found, default to 100
  IF v_monthly_limit IS NULL THEN
    v_monthly_limit := 100;
  END IF;

  -- Handle unlimited (-1 means no limit, use a very large number)
  IF v_monthly_limit = -1 THEN
    v_monthly_limit := 999999999;
  END IF;

  RETURN v_current_count < v_monthly_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE chatbot_message_usage IS 'Tracks monthly message usage per chatbot for subscription tier limits';
COMMENT ON FUNCTION increment_chatbot_message_count IS 'Increments message count and returns current usage vs limit';
COMMENT ON FUNCTION get_chatbot_message_usage IS 'Gets current message usage stats for a chatbot';
COMMENT ON FUNCTION can_chatbot_send_message IS 'Checks if chatbot is within monthly message limit';
