-- Migration: Add n8n workflow JSON storage to avatars table
-- This allows admins to store the specific n8n workflow configuration for each user's chatbot

-- Add the column for storing workflow JSON
ALTER TABLE avatars
  ADD COLUMN IF NOT EXISTS n8n_workflow_json JSONB;

-- Add a comment
COMMENT ON COLUMN avatars.n8n_workflow_json IS 'The n8n workflow JSON configuration specific to this chatbot (uploaded by admin)';

-- Notify completion
DO $$
BEGIN
  RAISE NOTICE 'Added n8n_workflow_json column to avatars table for storing workflow configurations';
END $$;
