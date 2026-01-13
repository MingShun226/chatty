-- Admin Notification System
-- Adds fields to followup_settings for admin WhatsApp notifications

-- Add notification fields to followup_settings
ALTER TABLE followup_settings
ADD COLUMN IF NOT EXISTS notification_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS notification_phone_number VARCHAR(20),
ADD COLUMN IF NOT EXISTS notify_on_purchase_intent BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS notify_on_wants_human BOOLEAN DEFAULT true;

-- Add comment for clarity
COMMENT ON COLUMN followup_settings.notification_enabled IS 'Enable WhatsApp notifications to admin';
COMMENT ON COLUMN followup_settings.notification_phone_number IS 'Admin phone number to receive WhatsApp alerts (with country code, no + symbol)';
COMMENT ON COLUMN followup_settings.notify_on_purchase_intent IS 'Notify when customer wants to buy';
COMMENT ON COLUMN followup_settings.notify_on_wants_human IS 'Notify when customer wants to speak to human agent';
