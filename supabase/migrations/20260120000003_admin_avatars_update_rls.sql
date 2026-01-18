-- Add UPDATE RLS policy for admins on avatars table
-- This allows admins to update chatbot configurations (webhook URL, workflow settings, etc.)

-- ============================================================================
-- AVATARS: Allow admins to UPDATE all avatars (for chatbot configuration)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'avatars'
    AND policyname = 'Admins can update all avatars'
  ) THEN
    CREATE POLICY "Admins can update all avatars"
    ON public.avatars
    FOR UPDATE
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());
  END IF;
END $$;

-- ============================================================================
-- AVATARS: Allow admins to INSERT avatars (if needed for future features)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'avatars'
    AND policyname = 'Admins can insert avatars'
  ) THEN
    CREATE POLICY "Admins can insert avatars"
    ON public.avatars
    FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin());
  END IF;
END $$;

-- Grant UPDATE permission explicitly
GRANT UPDATE ON public.avatars TO authenticated;

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Migration complete: Admin UPDATE policy for avatars added';
END $$;
