-- ============================================
-- Run this in Supabase SQL Editor
-- Go to: https://supabase.com/dashboard/project/xatrtqdgghanwdujyhkq/sql/new
-- ============================================

-- Add WhatsApp message settings columns
ALTER TABLE avatars
ADD COLUMN IF NOT EXISTS whatsapp_message_delimiter TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS whatsapp_typing_wpm INTEGER DEFAULT 200;

-- Done! You should see "Success. No rows returned"
