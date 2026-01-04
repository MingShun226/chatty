-- ============================================
-- WhatsApp Image Sending and Message Batching
-- ============================================

-- Add columns for new WhatsApp features
ALTER TABLE avatars
ADD COLUMN IF NOT EXISTS whatsapp_enable_images BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS whatsapp_message_batch_timeout INTEGER DEFAULT 0;

-- Comments
COMMENT ON COLUMN avatars.whatsapp_enable_images IS 'Enable sending images via WhatsApp (from n8n response)';
COMMENT ON COLUMN avatars.whatsapp_message_batch_timeout IS 'Seconds to wait before sending batched messages to n8n (0 = disabled, 5-10 recommended)';
