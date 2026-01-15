-- Create a function to completely delete a user account including auth.users
-- This function uses SECURITY DEFINER to run with elevated privileges
-- Uses exception handling to gracefully handle missing tables

CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
BEGIN
  -- Get the current user's ID
  current_user_id := auth.uid();

  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Delete all user data in order (respecting foreign key constraints)
  -- Using exception handling for each delete in case table doesn't exist

  -- 1. Delete avatar prompt versions
  BEGIN
    DELETE FROM avatar_prompt_versions WHERE user_id = current_user_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  -- 2. Delete avatar training files
  BEGIN
    DELETE FROM avatar_training_files WHERE user_id = current_user_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  -- 3. Delete avatar training data
  BEGIN
    DELETE FROM avatar_training_data WHERE user_id = current_user_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  -- 4. Delete avatar knowledge files
  BEGIN
    DELETE FROM avatar_knowledge_files WHERE user_id = current_user_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  -- 5. Delete products (via chatbot_id)
  BEGIN
    DELETE FROM chatbot_products WHERE chatbot_id IN (SELECT id FROM avatars WHERE user_id = current_user_id);
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  -- 6. Delete promotion products
  BEGIN
    DELETE FROM promotion_products WHERE promotion_id IN (
      SELECT id FROM chatbot_promotions WHERE chatbot_id IN (SELECT id FROM avatars WHERE user_id = current_user_id)
    );
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  -- 7. Delete promotions
  BEGIN
    DELETE FROM chatbot_promotions WHERE chatbot_id IN (SELECT id FROM avatars WHERE user_id = current_user_id);
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  -- 8. Delete avatars
  BEGIN
    DELETE FROM avatars WHERE user_id = current_user_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  -- 9. Delete API keys
  BEGIN
    DELETE FROM api_keys WHERE user_id = current_user_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  -- 10. Delete followup history
  BEGIN
    DELETE FROM followup_history WHERE user_id = current_user_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  -- 11. Delete contact profiles
  BEGIN
    DELETE FROM contact_profiles WHERE user_id = current_user_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  -- 12. Delete followup settings
  BEGIN
    DELETE FROM followup_settings WHERE user_id = current_user_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  -- 13. Delete WhatsApp sessions
  BEGIN
    DELETE FROM whatsapp_sessions WHERE user_id = current_user_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  -- 14. Delete generated images
  BEGIN
    DELETE FROM generated_images WHERE user_id = current_user_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  -- 15. Delete generated videos
  BEGIN
    DELETE FROM generated_videos WHERE user_id = current_user_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  -- 16. Delete notifications
  BEGIN
    DELETE FROM user_notifications WHERE user_id = current_user_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  -- 17. Delete social connections
  BEGIN
    DELETE FROM social_connections WHERE user_id = current_user_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  -- 18. Delete broadcast messages
  BEGIN
    DELETE FROM broadcast_messages WHERE campaign_id IN (SELECT id FROM broadcast_campaigns WHERE user_id = current_user_id);
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  -- 19. Delete broadcast campaigns
  BEGIN
    DELETE FROM broadcast_campaigns WHERE user_id = current_user_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  -- 20. Delete token usage
  BEGIN
    DELETE FROM token_usage WHERE user_id = current_user_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  -- 21. Delete the profile
  BEGIN
    DELETE FROM profiles WHERE id = current_user_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  -- 22. Finally delete the auth user (this is the key part!)
  DELETE FROM auth.users WHERE id = current_user_id;

END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.delete_user_account() TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.delete_user_account() IS 'Completely deletes a user account and all associated data including the auth.users record';
