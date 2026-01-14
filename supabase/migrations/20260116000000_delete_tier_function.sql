-- Function to safely delete a subscription tier and all related records
-- This bypasses RLS issues by running with SECURITY DEFINER

CREATE OR REPLACE FUNCTION delete_subscription_tier(tier_id_to_delete UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_count INTEGER;
  result JSONB;
BEGIN
  -- Check if tier has users assigned
  SELECT COUNT(*) INTO user_count
  FROM profiles
  WHERE subscription_tier_id = tier_id_to_delete;

  IF user_count > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Tier has ' || user_count || ' users assigned. Move them to another tier first.'
    );
  END IF;

  -- Delete from user_subscriptions
  DELETE FROM user_subscriptions WHERE tier_id = tier_id_to_delete;

  -- Delete tier_upgrade_requests where this tier is the requested tier
  DELETE FROM tier_upgrade_requests WHERE requested_tier_id = tier_id_to_delete;

  -- Nullify current_tier_id references (preserve history)
  UPDATE tier_upgrade_requests
  SET current_tier_id = NULL
  WHERE current_tier_id = tier_id_to_delete;

  -- Delete the tier
  DELETE FROM subscription_tiers WHERE id = tier_id_to_delete;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Tier deleted successfully'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Grant execute permission to authenticated users (admin check happens in the function caller)
GRANT EXECUTE ON FUNCTION delete_subscription_tier(UUID) TO authenticated;
