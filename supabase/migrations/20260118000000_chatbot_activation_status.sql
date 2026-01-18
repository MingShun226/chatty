-- Migration: Add chatbot activation status and workflow type
-- This allows admin to control when a chatbot goes live

-- Add activation status to avatars table
ALTER TABLE avatars
  ADD COLUMN IF NOT EXISTS activation_status VARCHAR(20) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS workflow_type VARCHAR(50) DEFAULT 'ecommerce',
  ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS activated_by UUID REFERENCES auth.users(id);

-- Add constraint for valid activation statuses
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'valid_activation_status'
  ) THEN
    ALTER TABLE avatars
      ADD CONSTRAINT valid_activation_status
      CHECK (activation_status IN ('pending', 'active', 'suspended'));
  END IF;
END $$;

-- Add constraint for valid workflow types
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'valid_workflow_type'
  ) THEN
    ALTER TABLE avatars
      ADD CONSTRAINT valid_workflow_type
      CHECK (workflow_type IN ('ecommerce', 'appointment', 'property', 'support', 'custom'));
  END IF;
END $$;

-- Create index for quick filtering by activation status
CREATE INDEX IF NOT EXISTS idx_avatars_activation_status
  ON avatars(activation_status);

-- Update existing chatbots: mark as active if n8n is already configured
UPDATE avatars
SET activation_status = 'active',
    activated_at = COALESCE(n8n_configured_at, NOW())
WHERE n8n_webhook_url IS NOT NULL
  AND n8n_enabled = true
  AND activation_status = 'pending';

-- Add comment for documentation
COMMENT ON COLUMN avatars.activation_status IS 'Chatbot activation status: pending (waiting for admin), active (live), suspended (disabled)';
COMMENT ON COLUMN avatars.workflow_type IS 'Type of n8n workflow: ecommerce, appointment, property, support, custom';
COMMENT ON COLUMN avatars.activated_at IS 'Timestamp when admin activated the chatbot';
COMMENT ON COLUMN avatars.activated_by IS 'Admin user ID who activated the chatbot';
