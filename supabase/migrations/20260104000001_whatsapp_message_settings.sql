-- Add WhatsApp message settings to avatars table
ALTER TABLE avatars
ADD COLUMN IF NOT EXISTS whatsapp_message_delimiter TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS whatsapp_typing_wpm INTEGER DEFAULT 200;

-- Add comments
COMMENT ON COLUMN avatars.whatsapp_message_delimiter IS 'Custom delimiter for splitting long messages (e.g., "||"). If null, uses automatic sentence splitting.';
COMMENT ON COLUMN avatars.whatsapp_typing_wpm IS 'Typing speed in words per minute for WhatsApp typing indicator. Default: 200 WPM (average typing speed).';
