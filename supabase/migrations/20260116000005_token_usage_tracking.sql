-- Token Usage Tracking table
-- ================================================================
-- Tracks API usage for users across different services

CREATE TABLE IF NOT EXISTS token_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service VARCHAR(50) NOT NULL, -- 'openai', 'n8n', 'kie_ai', 'whatsapp'
  operation VARCHAR(100) NOT NULL, -- 'chat_completion', 'model_training', 'image_generation', 'video_generation'
  model VARCHAR(100), -- 'gpt-4', 'gpt-3.5-turbo', etc
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  cost_usd DECIMAL(10, 6) DEFAULT 0, -- Estimated cost in USD
  metadata JSONB DEFAULT '{}', -- Additional data like request details
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_token_usage_user_id ON token_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_token_usage_service ON token_usage(service);
CREATE INDEX IF NOT EXISTS idx_token_usage_created_at ON token_usage(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_token_usage_user_service ON token_usage(user_id, service);
CREATE INDEX IF NOT EXISTS idx_token_usage_user_date ON token_usage(user_id, created_at DESC);

-- Enable RLS
ALTER TABLE token_usage ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own usage
CREATE POLICY "Users can view own token usage"
  ON token_usage FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: System can insert usage records (via service role or edge functions)
CREATE POLICY "Service can insert token usage"
  ON token_usage FOR INSERT
  WITH CHECK (true);

-- Policy: Admins can view all usage
CREATE POLICY "Admins can view all token usage"
  ON token_usage FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.is_active = true
    )
  );

-- Create a view for aggregated daily usage stats
CREATE OR REPLACE VIEW user_daily_usage AS
SELECT
  user_id,
  service,
  DATE(created_at) as usage_date,
  COUNT(*) as request_count,
  SUM(input_tokens) as total_input_tokens,
  SUM(output_tokens) as total_output_tokens,
  SUM(total_tokens) as total_tokens,
  SUM(cost_usd) as total_cost_usd
FROM token_usage
GROUP BY user_id, service, DATE(created_at);

-- Create a view for monthly usage summary
CREATE OR REPLACE VIEW user_monthly_usage AS
SELECT
  user_id,
  service,
  DATE_TRUNC('month', created_at) as usage_month,
  COUNT(*) as request_count,
  SUM(input_tokens) as total_input_tokens,
  SUM(output_tokens) as total_output_tokens,
  SUM(total_tokens) as total_tokens,
  SUM(cost_usd) as total_cost_usd
FROM token_usage
GROUP BY user_id, service, DATE_TRUNC('month', created_at);

-- Function to log token usage (can be called from edge functions or triggers)
CREATE OR REPLACE FUNCTION log_token_usage(
  p_user_id UUID,
  p_service VARCHAR(50),
  p_operation VARCHAR(100),
  p_model VARCHAR(100) DEFAULT NULL,
  p_input_tokens INTEGER DEFAULT 0,
  p_output_tokens INTEGER DEFAULT 0,
  p_cost_usd DECIMAL(10, 6) DEFAULT 0,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO token_usage (
    user_id, service, operation, model,
    input_tokens, output_tokens, total_tokens,
    cost_usd, metadata
  ) VALUES (
    p_user_id, p_service, p_operation, p_model,
    p_input_tokens, p_output_tokens, p_input_tokens + p_output_tokens,
    p_cost_usd, p_metadata
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comment for documentation
COMMENT ON TABLE token_usage IS 'Tracks API token usage across different services for billing and analytics';
