-- Admin-assigned API keys for platform-managed billing
-- Allows admins to assign API keys to users from the platform's OpenAI account

CREATE TABLE IF NOT EXISTS admin_assigned_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service VARCHAR(50) NOT NULL, -- 'openai', 'anthropic', 'stability', etc.
  api_key_encrypted TEXT NOT NULL, -- Base64 encoded (same as user_api_keys for consistency)
  project_name VARCHAR(255), -- OpenAI project name for admin reference
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Admin who assigned the key
  notes TEXT, -- Admin notes about this key
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, service) -- One key per service per user
);

-- Indexes
CREATE INDEX idx_admin_assigned_api_keys_user_id ON admin_assigned_api_keys(user_id);
CREATE INDEX idx_admin_assigned_api_keys_service ON admin_assigned_api_keys(service);
CREATE INDEX idx_admin_assigned_api_keys_active ON admin_assigned_api_keys(user_id, service) WHERE is_active = true;

-- Enable RLS
ALTER TABLE admin_assigned_api_keys ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can do everything
CREATE POLICY "Admins can manage all admin_assigned_api_keys"
  ON admin_assigned_api_keys
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.user_id = auth.uid()
      AND au.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.user_id = auth.uid()
      AND au.is_active = true
    )
  );

-- Policy: Users can read their own keys (for checking if key exists, but key is masked in app)
CREATE POLICY "Users can view their own admin_assigned_api_keys"
  ON admin_assigned_api_keys
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_admin_assigned_api_keys_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_admin_assigned_api_keys_updated_at
  BEFORE UPDATE ON admin_assigned_api_keys
  FOR EACH ROW
  EXECUTE FUNCTION update_admin_assigned_api_keys_updated_at();

-- Comment on table
COMMENT ON TABLE admin_assigned_api_keys IS 'API keys assigned by admins to users for platform-managed billing. Each user can have one key per service (e.g., openai, anthropic).';
COMMENT ON COLUMN admin_assigned_api_keys.api_key_encrypted IS 'Base64 encoded API key. Use atob() to decrypt.';
COMMENT ON COLUMN admin_assigned_api_keys.project_name IS 'OpenAI project name for tracking usage in OpenAI dashboard.';
