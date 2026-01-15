-- Add terms and conditions setting
-- ================================================================

INSERT INTO platform_settings (setting_key, setting_value, description)
VALUES
  ('terms_and_conditions', '{"enabled": false, "content": "", "last_updated": null}', 'Terms and conditions content')
ON CONFLICT (setting_key) DO NOTHING;
