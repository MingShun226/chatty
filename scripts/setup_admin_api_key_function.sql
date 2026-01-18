-- ============================================================================
-- Setup Script: Admin Platform API Keys Function
-- Run this in Supabase SQL Editor
-- This allows admins to create API keys for any user, bypassing RLS
-- ============================================================================

-- ============================================================================
-- STEP 1: Create the SECURITY DEFINER function
-- ============================================================================
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

  -- Insert the API key with the target user's ID (not the admin's ID)
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

-- ============================================================================
-- STEP 2: Add RLS policies for admins to manage platform_api_keys
-- ============================================================================

-- Admin SELECT policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'platform_api_keys'
    AND policyname = 'Admins can view all platform API keys'
  ) THEN
    CREATE POLICY "Admins can view all platform API keys"
    ON public.platform_api_keys
    FOR SELECT
    TO authenticated
    USING (public.is_admin());
    RAISE NOTICE 'Created policy: Admins can view all platform API keys';
  ELSE
    RAISE NOTICE 'Policy already exists: Admins can view all platform API keys';
  END IF;
END $$;

-- Admin INSERT policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'platform_api_keys'
    AND policyname = 'Admins can insert platform API keys'
  ) THEN
    CREATE POLICY "Admins can insert platform API keys"
    ON public.platform_api_keys
    FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin());
    RAISE NOTICE 'Created policy: Admins can insert platform API keys';
  ELSE
    RAISE NOTICE 'Policy already exists: Admins can insert platform API keys';
  END IF;
END $$;

-- Admin UPDATE policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'platform_api_keys'
    AND policyname = 'Admins can update platform API keys'
  ) THEN
    CREATE POLICY "Admins can update platform API keys"
    ON public.platform_api_keys
    FOR UPDATE
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());
    RAISE NOTICE 'Created policy: Admins can update platform API keys';
  ELSE
    RAISE NOTICE 'Policy already exists: Admins can update platform API keys';
  END IF;
END $$;

-- Admin DELETE policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'platform_api_keys'
    AND policyname = 'Admins can delete platform API keys'
  ) THEN
    CREATE POLICY "Admins can delete platform API keys"
    ON public.platform_api_keys
    FOR DELETE
    TO authenticated
    USING (public.is_admin());
    RAISE NOTICE 'Created policy: Admins can delete platform API keys';
  ELSE
    RAISE NOTICE 'Policy already exists: Admins can delete platform API keys';
  END IF;
END $$;

-- Grant permissions
GRANT ALL ON public.platform_api_keys TO authenticated;

-- ============================================================================
-- VERIFICATION: Test the function exists
-- ============================================================================
SELECT
  routine_name,
  routine_type,
  security_type
FROM information_schema.routines
WHERE routine_name = 'admin_create_platform_api_key';

RAISE NOTICE '✅ Setup complete! Admin can now create API keys for any user.';
