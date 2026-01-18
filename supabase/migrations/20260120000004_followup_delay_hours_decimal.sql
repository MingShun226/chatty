-- Change followup_delay_hours from integer to numeric to support fractional hours
-- This allows settings like 0.0833 (5 min), 0.5 (30 min), etc.

-- Update followup_tags table
ALTER TABLE followup_tags
  ALTER COLUMN followup_delay_hours TYPE NUMERIC(10,4) USING followup_delay_hours::NUMERIC(10,4);

-- Update default value
ALTER TABLE followup_tags
  ALTER COLUMN followup_delay_hours SET DEFAULT 24;

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Migration complete: followup_delay_hours changed to NUMERIC for decimal support';
END $$;
