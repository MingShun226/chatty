-- ====================================================
-- Add orders_sheet_url column to avatars table
-- Stores the Google Sheets link for customer orders
-- ====================================================

ALTER TABLE avatars
ADD COLUMN IF NOT EXISTS orders_sheet_url TEXT;

COMMENT ON COLUMN avatars.orders_sheet_url IS 'Google Sheets URL where customer orders are recorded';
