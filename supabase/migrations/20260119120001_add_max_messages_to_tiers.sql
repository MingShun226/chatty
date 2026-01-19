-- ====================================================
-- ADD MAX_MESSAGES TO SUBSCRIPTION TIERS
-- Free: 100 messages/month, Pro: 1000 messages/month
-- ====================================================

-- Add max_messages column to subscription_tiers
ALTER TABLE subscription_tiers
ADD COLUMN IF NOT EXISTS max_messages INTEGER DEFAULT 100;

COMMENT ON COLUMN subscription_tiers.max_messages IS 'Monthly message limit per chatbot. -1 means unlimited.';

-- Update existing tiers with message limits
-- Free tier: 100 messages
UPDATE subscription_tiers
SET max_messages = 100
WHERE name = 'free' OR display_name ILIKE '%free%';

-- Pro/Starter tier: 1000 messages
UPDATE subscription_tiers
SET max_messages = 1000
WHERE name = 'pro' OR name = 'starter' OR display_name ILIKE '%pro%' OR display_name ILIKE '%starter%';

-- Business/Growth tier: 5000 messages
UPDATE subscription_tiers
SET max_messages = 5000
WHERE name = 'business' OR name = 'growth' OR display_name ILIKE '%business%' OR display_name ILIKE '%growth%';

-- Enterprise tier: unlimited (-1)
UPDATE subscription_tiers
SET max_messages = -1
WHERE name = 'enterprise' OR display_name ILIKE '%enterprise%' OR display_name ILIKE '%unlimited%';
