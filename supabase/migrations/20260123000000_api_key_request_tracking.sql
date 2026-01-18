-- Add API key request tracking to profiles table
-- Users can request an API key from admin during onboarding

-- Add columns to track API key requests
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS api_key_requested BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS api_key_requested_at TIMESTAMPTZ;

-- Add index for admin queries to find users who requested API keys
CREATE INDEX IF NOT EXISTS idx_profiles_api_key_requested
  ON profiles (api_key_requested)
  WHERE api_key_requested = TRUE;

-- Comment for documentation
COMMENT ON COLUMN profiles.api_key_requested IS 'True if user requested an API key from admin during onboarding';
COMMENT ON COLUMN profiles.api_key_requested_at IS 'Timestamp when user requested the API key';
