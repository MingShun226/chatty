-- Migration: Chatbot Setup Workflow
-- Adds fields to track the setup process between user content input and admin n8n configuration

-- Add chatbot type and setup tracking fields to avatars
ALTER TABLE avatars
  ADD COLUMN IF NOT EXISTS chatbot_type VARCHAR(50) DEFAULT 'ecommerce',
  ADD COLUMN IF NOT EXISTS activation_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS setup_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS setup_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS setup_completed_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS n8n_workflow_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS n8n_workflow_url TEXT,
  ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- First, migrate existing chatbot_type values to new valid values
UPDATE avatars
SET chatbot_type = 'ecommerce'
WHERE chatbot_type IS NULL
   OR chatbot_type NOT IN ('ecommerce', 'appointment', 'support', 'custom');

-- Add constraint for valid chatbot types
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'valid_chatbot_type'
  ) THEN
    ALTER TABLE avatars
      ADD CONSTRAINT valid_chatbot_type
      CHECK (chatbot_type IN ('ecommerce', 'appointment', 'support', 'custom'));
  END IF;
END $$;

-- Create index for quick filtering by activation status and request time
CREATE INDEX IF NOT EXISTS idx_avatars_activation_requested
  ON avatars(activation_requested_at DESC)
  WHERE activation_requested_at IS NOT NULL;

-- Create index for chatbot type
CREATE INDEX IF NOT EXISTS idx_avatars_chatbot_type
  ON avatars(chatbot_type);

-- Add comments for documentation
COMMENT ON COLUMN avatars.chatbot_type IS 'Type of chatbot: ecommerce (product inquiries), appointment (booking), support (FAQ), custom';
COMMENT ON COLUMN avatars.activation_requested_at IS 'When user clicked Request Setup - enters admin queue';
COMMENT ON COLUMN avatars.setup_started_at IS 'When admin started working on this chatbot';
COMMENT ON COLUMN avatars.setup_completed_at IS 'When admin completed the n8n workflow setup';
COMMENT ON COLUMN avatars.setup_completed_by IS 'Admin who completed the setup';
COMMENT ON COLUMN avatars.n8n_workflow_name IS 'Name/identifier of the n8n workflow for tracking';
COMMENT ON COLUMN avatars.n8n_workflow_url IS 'Direct URL to the n8n workflow for quick access';
COMMENT ON COLUMN avatars.admin_notes IS 'Admin notes about customizations or special requirements';

-- Update activation_status constraint to include new statuses
-- First drop the old constraint if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'valid_activation_status'
  ) THEN
    ALTER TABLE avatars DROP CONSTRAINT valid_activation_status;
  END IF;
END $$;

-- Add new constraint with additional statuses
ALTER TABLE avatars
  ADD CONSTRAINT valid_activation_status
  CHECK (activation_status IN ('draft', 'pending', 'setting_up', 'active', 'suspended'));

-- Update existing chatbots without activation_requested_at to 'draft' status
UPDATE avatars
SET activation_status = 'draft'
WHERE activation_status = 'pending'
  AND activation_requested_at IS NULL;

-- Create a view for admin to easily see pending setup requests
CREATE OR REPLACE VIEW admin_pending_setups AS
SELECT
  a.id AS chatbot_id,
  a.name AS chatbot_name,
  a.chatbot_type,
  a.company_name,
  a.industry,
  a.activation_status,
  a.activation_requested_at,
  a.setup_started_at,
  a.n8n_workflow_name,
  a.n8n_workflow_url,
  a.created_at AS chatbot_created_at,
  p.id AS user_id,
  p.email AS user_email,
  p.name AS user_name,
  p.phone AS user_phone,
  (SELECT COUNT(*) FROM chatbot_products cp WHERE cp.chatbot_id = a.id) AS products_count,
  (SELECT COUNT(*) FROM chatbot_promotions pr WHERE pr.chatbot_id = a.id AND pr.is_active = true) AS promotions_count,
  (SELECT COUNT(*) FROM avatar_knowledge_files kf WHERE kf.avatar_id = a.id) AS documents_count,
  (SELECT EXISTS(SELECT 1 FROM avatar_prompt_versions pv WHERE pv.avatar_id = a.id AND pv.is_active = true)) AS has_prompt
FROM avatars a
JOIN profiles p ON p.id = a.user_id
WHERE a.activation_status IN ('pending', 'setting_up')
  AND a.status = 'active'
ORDER BY
  CASE a.activation_status
    WHEN 'pending' THEN 1
    WHEN 'setting_up' THEN 2
  END,
  a.activation_requested_at ASC;

-- Grant access to the view for authenticated users (RLS will still apply on underlying tables)
GRANT SELECT ON admin_pending_setups TO authenticated;

-- Log the migration
DO $$
BEGIN
  RAISE NOTICE 'Migration complete: Chatbot Setup Workflow';
  RAISE NOTICE 'Added fields: chatbot_type, activation_requested_at, setup_started_at, setup_completed_at, setup_completed_by, n8n_workflow_name, n8n_workflow_url, admin_notes';
  RAISE NOTICE 'Created view: admin_pending_setups';
END $$;
