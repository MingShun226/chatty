-- Add feature access columns to subscription_tiers
-- Change yearly to quarterly with 17% discount

-- Add new columns for feature access
ALTER TABLE subscription_tiers
ADD COLUMN IF NOT EXISTS price_quarterly DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '{
  "chatbot": {
    "knowledge_base": true,
    "ai_training": false,
    "whatsapp_integration": true,
    "contacts_management": true,
    "follow_ups": true,
    "prompt_engineer": false
  },
  "advertising": {
    "images_studio": false,
    "video_studio": false
  }
}'::jsonb;

-- Update existing tiers with quarterly pricing (17% discount on monthly * 3)
UPDATE subscription_tiers
SET price_quarterly = ROUND(price_monthly * 3 * 0.83, 2)
WHERE price_quarterly = 0 OR price_quarterly IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN subscription_tiers.price_quarterly IS 'Quarterly price with 17% discount applied (monthly * 3 * 0.83)';
COMMENT ON COLUMN subscription_tiers.features IS 'JSON object defining feature access: chatbot features and advertising features';
