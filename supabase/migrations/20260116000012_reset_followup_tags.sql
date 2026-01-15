-- Reset follow-up tags to simplified 5-tag system
-- This migration cleans up old system tags and ensures only 5 default tags exist

-- Step 1: Delete old system tags that are not in the new list
DELETE FROM followup_tags
WHERE is_system = true
  AND tag_name NOT IN ('hot_lead', 'new_lead', 'customer', 'needs_help', 'inactive');

-- Step 2: Update existing system tags with correct settings
-- Update hot_lead
UPDATE followup_tags
SET description = 'High interest, likely to convert',
    color = '#f59e0b',
    auto_followup = true,
    followup_delay_hours = 24
WHERE tag_name = 'hot_lead' AND is_system = true;

-- Update new_lead
UPDATE followup_tags
SET description = 'First-time inquiry, getting information',
    color = '#3b82f6',
    auto_followup = true,
    followup_delay_hours = 48
WHERE tag_name = 'new_lead' AND is_system = true;

-- Update customer
UPDATE followup_tags
SET description = 'Already purchased or existing customer',
    color = '#10b981',
    auto_followup = false,
    followup_delay_hours = 0
WHERE tag_name = 'customer' AND is_system = true;

-- Update needs_help
UPDATE followup_tags
SET description = 'Has questions or issues to resolve',
    color = '#ef4444',
    auto_followup = true,
    followup_delay_hours = 24
WHERE tag_name = 'needs_help' AND is_system = true;

-- Update inactive
UPDATE followup_tags
SET description = 'Conversation went cold, no engagement',
    color = '#6b7280',
    auto_followup = false,
    followup_delay_hours = 0
WHERE tag_name = 'inactive' AND is_system = true;

-- Step 3: Update the initialize_default_tags function with the new 5 tags
CREATE OR REPLACE FUNCTION initialize_default_tags(p_chatbot_id UUID, p_user_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO followup_tags (chatbot_id, user_id, tag_name, description, color, auto_followup, followup_delay_hours, is_system)
  VALUES
    (p_chatbot_id, p_user_id, 'hot_lead', 'High interest, likely to convert', '#f59e0b', true, 24, true),
    (p_chatbot_id, p_user_id, 'new_lead', 'First-time inquiry, getting information', '#3b82f6', true, 48, true),
    (p_chatbot_id, p_user_id, 'customer', 'Already purchased or existing customer', '#10b981', false, 0, true),
    (p_chatbot_id, p_user_id, 'needs_help', 'Has questions or issues to resolve', '#ef4444', true, 24, true),
    (p_chatbot_id, p_user_id, 'inactive', 'Conversation went cold, no engagement', '#6b7280', false, 0, true)
  ON CONFLICT (chatbot_id, tag_name) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Follow-up tags reset to 5-tag system:';
  RAISE NOTICE '  ✓ hot_lead - High interest, likely to convert (24h auto-followup)';
  RAISE NOTICE '  ✓ new_lead - First-time inquiry (48h auto-followup)';
  RAISE NOTICE '  ✓ customer - Already purchased (no auto-followup)';
  RAISE NOTICE '  ✓ needs_help - Has questions/issues (24h auto-followup)';
  RAISE NOTICE '  ✓ inactive - Conversation went cold (no auto-followup)';
END $$;
