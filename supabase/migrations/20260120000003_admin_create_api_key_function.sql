-- Create a SECURITY DEFINER function for admins to create API keys for any user
-- This bypasses RLS so admins can insert with any user_id

CREATE OR REPLACE FUNCTION admin_create_platform_api_key(
  p_user_id UUID,
  p_key_name TEXT,
  p_api_key_hash TEXT,
  p_api_key_prefix TEXT,
  p_scopes TEXT[],
  p_avatar_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key_id UUID;
BEGIN
  -- Check if caller is admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can use this function';
  END IF;

  -- Insert the API key
  INSERT INTO platform_api_keys (
    user_id,
    key_name,
    api_key_hash,
    api_key_prefix,
    scopes,
    avatar_id,
    description,
    status
  ) VALUES (
    p_user_id,
    p_key_name,
    p_api_key_hash,
    p_api_key_prefix,
    p_scopes,
    p_avatar_id,
    p_description,
    'active'
  )
  RETURNING id INTO v_key_id;

  RETURN v_key_id;
END;
$$;

-- Grant execute permission to authenticated users (function checks admin internally)
GRANT EXECUTE ON FUNCTION admin_create_platform_api_key TO authenticated;

COMMENT ON FUNCTION admin_create_platform_api_key IS 'Allows admins to create platform API keys for any user, bypassing RLS';
