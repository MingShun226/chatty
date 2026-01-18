-- Add RLS policies for admins to manage platform_api_keys for all users
-- This allows admin to generate and manage API keys for users' chatbots

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
  END IF;
END $$;

-- Grant permissions
GRANT ALL ON public.platform_api_keys TO authenticated;

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Migration complete: Admin RLS policies for platform_api_keys added';
END $$;
