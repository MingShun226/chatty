-- Fix: Admin RLS policies for platform_api_keys
-- Run this in Supabase SQL Editor

-- Check if is_admin function exists
SELECT EXISTS (
  SELECT 1 FROM pg_proc WHERE proname = 'is_admin'
) as is_admin_function_exists;

-- ============================================================================
-- PLATFORM API KEYS: Allow admins to SELECT all platform API keys
-- ============================================================================
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

-- ============================================================================
-- PLATFORM API KEYS: Allow admins to INSERT platform API keys for users
-- ============================================================================
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

-- ============================================================================
-- PLATFORM API KEYS: Allow admins to UPDATE platform API keys
-- ============================================================================
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

-- ============================================================================
-- PLATFORM API KEYS: Allow admins to DELETE platform API keys
-- ============================================================================
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
-- DEBUG: Check recently created API keys and their owners
-- ============================================================================
SELECT
  pak.id,
  pak.key_name,
  pak.api_key_prefix,
  pak.user_id as api_key_user_id,
  pak.avatar_id,
  pak.status,
  pak.created_at,
  u.email as user_email,
  a.name as avatar_name,
  a.user_id as avatar_user_id
FROM platform_api_keys pak
LEFT JOIN auth.users u ON pak.user_id = u.id
LEFT JOIN avatars a ON pak.avatar_id = a.id
ORDER BY pak.created_at DESC
LIMIT 10;

-- ============================================================================
-- DEBUG: Check if a specific chatbot belongs to a user
-- Run this to verify: replace the IDs with actual values
-- ============================================================================
-- SELECT
--   a.id as avatar_id,
--   a.name as avatar_name,
--   a.user_id as avatar_user_id,
--   u.email as user_email
-- FROM avatars a
-- JOIN auth.users u ON a.user_id = u.id
-- WHERE a.id = 'd4e135d0-d7be-4351-b6b2-c2ec1a60069f';

RAISE NOTICE 'Admin RLS policies check/fix complete!';
