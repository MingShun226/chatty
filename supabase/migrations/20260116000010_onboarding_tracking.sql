-- Add onboarding tracking fields to profiles table
-- ================================================================
-- Tracks whether users have completed the onboarding wizard

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS onboarding_skipped BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS industry VARCHAR(100),
ADD COLUMN IF NOT EXISTS company_size VARCHAR(50),
ADD COLUMN IF NOT EXISTS use_case VARCHAR(100);

-- Comments for documentation
COMMENT ON COLUMN profiles.onboarding_completed IS 'Whether user completed the onboarding wizard';
COMMENT ON COLUMN profiles.onboarding_completed_at IS 'Timestamp when onboarding was completed';
COMMENT ON COLUMN profiles.onboarding_skipped IS 'Whether user skipped the onboarding wizard';
COMMENT ON COLUMN profiles.industry IS 'User selected industry during onboarding';
COMMENT ON COLUMN profiles.company_size IS 'Company size: solo, small, medium, large, enterprise';
COMMENT ON COLUMN profiles.use_case IS 'Primary use case: customer_support, sales, marketing, etc';

-- Create index for quick onboarding status checks
CREATE INDEX IF NOT EXISTS idx_profiles_onboarding ON profiles(onboarding_completed) WHERE onboarding_completed = false;
