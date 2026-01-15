-- Fix missing tags after reset migration
-- This ensures all 5 default tags exist for all chatbots

-- Insert missing tags for all existing chatbots that have followup_tags
-- Using a CTE to get distinct chatbot/user combinations
INSERT INTO followup_tags (chatbot_id, user_id, tag_name, description, color, auto_followup, followup_delay_hours, is_system)
SELECT DISTINCT
  ft.chatbot_id,
  ft.user_id,
  tag.tag_name,
  tag.description,
  tag.color,
  tag.auto_followup,
  tag.followup_delay_hours,
  true as is_system
FROM followup_tags ft
CROSS JOIN (
  VALUES
    ('hot_lead', 'High interest, likely to convert', '#f59e0b', true, 24),
    ('new_lead', 'First-time inquiry, getting information', '#3b82f6', true, 48),
    ('customer', 'Already purchased or existing customer', '#10b981', false, 0),
    ('needs_help', 'Has questions or issues to resolve', '#ef4444', true, 24),
    ('inactive', 'Conversation went cold, no engagement', '#6b7280', false, 0)
) AS tag(tag_name, description, color, auto_followup, followup_delay_hours)
ON CONFLICT (chatbot_id, tag_name) DO UPDATE SET
  description = EXCLUDED.description,
  color = EXCLUDED.color,
  auto_followup = EXCLUDED.auto_followup,
  followup_delay_hours = EXCLUDED.followup_delay_hours;

-- Also insert for chatbots that have followup_settings but no tags yet
INSERT INTO followup_tags (chatbot_id, user_id, tag_name, description, color, auto_followup, followup_delay_hours, is_system)
SELECT DISTINCT
  fs.chatbot_id,
  fs.user_id,
  tag.tag_name,
  tag.description,
  tag.color,
  tag.auto_followup,
  tag.followup_delay_hours,
  true as is_system
FROM followup_settings fs
CROSS JOIN (
  VALUES
    ('hot_lead', 'High interest, likely to convert', '#f59e0b', true, 24),
    ('new_lead', 'First-time inquiry, getting information', '#3b82f6', true, 48),
    ('customer', 'Already purchased or existing customer', '#10b981', false, 0),
    ('needs_help', 'Has questions or issues to resolve', '#ef4444', true, 24),
    ('inactive', 'Conversation went cold, no engagement', '#6b7280', false, 0)
) AS tag(tag_name, description, color, auto_followup, followup_delay_hours)
WHERE NOT EXISTS (
  SELECT 1 FROM followup_tags ft WHERE ft.chatbot_id = fs.chatbot_id
)
ON CONFLICT (chatbot_id, tag_name) DO NOTHING;

-- Log completion
DO $$
DECLARE
  tag_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO tag_count FROM followup_tags WHERE is_system = true;
  RAISE NOTICE 'Fix applied. Total system tags: %', tag_count;
END $$;
