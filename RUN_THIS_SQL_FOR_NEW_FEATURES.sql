-- ============================================
-- Run this in Supabase SQL Editor
-- Go to: https://supabase.com/dashboard/project/xatrtqdgghanwdujyhkq/sql/new
-- ============================================

-- Add WhatsApp image sending and message batching settings
ALTER TABLE avatars
ADD COLUMN IF NOT EXISTS whatsapp_enable_images BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS whatsapp_message_batch_timeout INTEGER DEFAULT 0;

-- Done! You should see "Success. No rows returned"
--
-- Settings explanation:
-- whatsapp_enable_images: true = chatbot can send images from n8n response
-- whatsapp_message_batch_timeout: 0 = disabled, 5-10 = seconds to wait before combining messages
