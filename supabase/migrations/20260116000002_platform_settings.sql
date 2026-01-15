-- Platform Settings table for admin-configurable platform options
-- ================================================================

-- Create platform_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key VARCHAR(100) UNIQUE NOT NULL,
  setting_value JSONB NOT NULL DEFAULT '{}',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_platform_settings_key ON platform_settings(setting_key);

-- Insert default platform settings
INSERT INTO platform_settings (setting_key, setting_value, description)
VALUES
  ('platform_name', '"Chatty"', 'Platform display name'),
  ('platform_description', '"AI-Powered Chatbot Platform"', 'Platform tagline/description'),
  ('logo_url', '""', 'Platform logo URL'),
  ('favicon_url', '""', 'Platform favicon URL'),
  ('primary_color', '"#6366f1"', 'Primary brand color'),
  ('support_email', '""', 'Support email address'),
  ('support_phone', '""', 'Support phone number'),
  ('support_whatsapp', '""', 'Support WhatsApp number'),
  ('payment_gateway', '"manual"', 'Payment gateway type: manual, stripe, or none')
ON CONFLICT (setting_key) DO NOTHING;

-- Enable RLS
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read platform settings (for branding display)
CREATE POLICY "Anyone can read platform settings"
  ON platform_settings FOR SELECT
  USING (true);

-- Policy: Only super_admin can update platform settings
CREATE POLICY "Super admin can update platform settings"
  ON platform_settings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.role = 'super_admin'
      AND admin_users.is_active = true
    )
  );

-- Policy: Only super_admin can insert platform settings
CREATE POLICY "Super admin can insert platform settings"
  ON platform_settings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.role = 'super_admin'
      AND admin_users.is_active = true
    )
  );

-- Function to update timestamp on modification
CREATE OR REPLACE FUNCTION update_platform_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update timestamp
DROP TRIGGER IF EXISTS platform_settings_update_timestamp ON platform_settings;
CREATE TRIGGER platform_settings_update_timestamp
  BEFORE UPDATE ON platform_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_platform_settings_timestamp();

-- Add comment for documentation
COMMENT ON TABLE platform_settings IS 'Platform-wide configuration settings managed by super admins';
