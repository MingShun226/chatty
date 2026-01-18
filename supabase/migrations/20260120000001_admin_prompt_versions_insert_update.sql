-- Add INSERT and UPDATE RLS policies for admins on avatar_prompt_versions
-- This allows admins to generate and save prompts for users

-- ============================================================================
-- AVATAR PROMPT VERSIONS: Allow admins to INSERT prompt versions for users
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'avatar_prompt_versions'
    AND policyname = 'Admins can insert prompt versions'
  ) THEN
    CREATE POLICY "Admins can insert prompt versions"
    ON public.avatar_prompt_versions
    FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin());
  END IF;
END $$;

-- ============================================================================
-- AVATAR PROMPT VERSIONS: Allow admins to UPDATE prompt versions
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'avatar_prompt_versions'
    AND policyname = 'Admins can update prompt versions'
  ) THEN
    CREATE POLICY "Admins can update prompt versions"
    ON public.avatar_prompt_versions
    FOR UPDATE
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());
  END IF;
END $$;

-- ============================================================================
-- AVATAR PROMPT VERSIONS: Allow users to INSERT their own prompt versions
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'avatar_prompt_versions'
    AND policyname = 'Users can insert their own prompt versions'
  ) THEN
    CREATE POLICY "Users can insert their own prompt versions"
    ON public.avatar_prompt_versions
    FOR INSERT
    TO authenticated
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.avatars
        WHERE avatars.id = avatar_prompt_versions.avatar_id
          AND avatars.user_id = auth.uid()
      )
    );
  END IF;
END $$;

-- ============================================================================
-- AVATAR PROMPT VERSIONS: Allow users to UPDATE their own prompt versions
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'avatar_prompt_versions'
    AND policyname = 'Users can update their own prompt versions'
  ) THEN
    CREATE POLICY "Users can update their own prompt versions"
    ON public.avatar_prompt_versions
    FOR UPDATE
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.avatars
        WHERE avatars.id = avatar_prompt_versions.avatar_id
          AND avatars.user_id = auth.uid()
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.avatars
        WHERE avatars.id = avatar_prompt_versions.avatar_id
          AND avatars.user_id = auth.uid()
      )
    );
  END IF;
END $$;

-- Grant INSERT and UPDATE permissions
GRANT INSERT, UPDATE ON public.avatar_prompt_versions TO authenticated;

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Migration complete: Admin INSERT/UPDATE policies for avatar_prompt_versions added';
END $$;
