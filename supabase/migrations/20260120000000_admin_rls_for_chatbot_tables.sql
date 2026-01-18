-- Add RLS policies to allow admin users to view all chatbot-related data
-- This enables admin to see user content in the Admin > User Details page
-- Uses DO blocks to avoid errors if policies already exist

-- ============================================================================
-- CHATBOT PRODUCTS: Allow admins to view all products
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'chatbot_products'
    AND policyname = 'Admins can view all chatbot products'
  ) THEN
    CREATE POLICY "Admins can view all chatbot products"
    ON public.chatbot_products
    FOR SELECT
    TO authenticated
    USING (public.is_admin());
  END IF;
END $$;

-- ============================================================================
-- CHATBOT PROMOTIONS: Allow admins to view all promotions
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'chatbot_promotions'
    AND policyname = 'Admins can view all chatbot promotions'
  ) THEN
    CREATE POLICY "Admins can view all chatbot promotions"
    ON public.chatbot_promotions
    FOR SELECT
    TO authenticated
    USING (public.is_admin());
  END IF;
END $$;

-- ============================================================================
-- CONTACT PROFILES: Allow admins to view all contacts
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'contact_profiles'
    AND policyname = 'Admins can view all contact profiles'
  ) THEN
    CREATE POLICY "Admins can view all contact profiles"
    ON public.contact_profiles
    FOR SELECT
    TO authenticated
    USING (public.is_admin());
  END IF;
END $$;

-- ============================================================================
-- WHATSAPP MESSAGES: Allow admins to view all messages
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'whatsapp_messages'
    AND policyname = 'Admins can view all whatsapp messages'
  ) THEN
    CREATE POLICY "Admins can view all whatsapp messages"
    ON public.whatsapp_messages
    FOR SELECT
    TO authenticated
    USING (public.is_admin());
  END IF;
END $$;

-- ============================================================================
-- WHATSAPP WEB SESSIONS: Allow admins to view all sessions
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'whatsapp_web_sessions'
    AND policyname = 'Admins can view all whatsapp sessions'
  ) THEN
    CREATE POLICY "Admins can view all whatsapp sessions"
    ON public.whatsapp_web_sessions
    FOR SELECT
    TO authenticated
    USING (public.is_admin());
  END IF;
END $$;

-- ============================================================================
-- AVATAR PROMPT VERSIONS: Allow admins to view all prompt versions
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'avatar_prompt_versions'
    AND policyname = 'Admins can view all prompt versions'
  ) THEN
    CREATE POLICY "Admins can view all prompt versions"
    ON public.avatar_prompt_versions
    FOR SELECT
    TO authenticated
    USING (public.is_admin());
  END IF;
END $$;

-- ============================================================================
-- FOLLOWUP HISTORY: Allow admins to view all followup history
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'followup_history') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'followup_history'
      AND policyname = 'Admins can view all followup history'
    ) THEN
      CREATE POLICY "Admins can view all followup history"
      ON public.followup_history
      FOR SELECT
      TO authenticated
      USING (public.is_admin());
    END IF;
  END IF;
END $$;

-- ============================================================================
-- CHATBOT PRODUCT UPLOADS: Allow admins to view all uploads
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'chatbot_product_uploads') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'chatbot_product_uploads'
      AND policyname = 'Admins can view all product uploads'
    ) THEN
      CREATE POLICY "Admins can view all product uploads"
      ON public.chatbot_product_uploads
      FOR SELECT
      TO authenticated
      USING (public.is_admin());
    END IF;
  END IF;
END $$;

-- ============================================================================
-- AVATARS: Allow admins to view all avatars (chatbots)
-- Note: Skip if already exists
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'avatars'
    AND policyname = 'Admins can view all avatars'
  ) THEN
    CREATE POLICY "Admins can view all avatars"
    ON public.avatars
    FOR SELECT
    TO authenticated
    USING (public.is_admin());
  END IF;
END $$;

-- ============================================================================
-- PROFILES: Allow admins to view all profiles
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles'
    AND policyname = 'Admins can view all profiles'
  ) THEN
    CREATE POLICY "Admins can view all profiles"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (public.is_admin());
  END IF;
END $$;

-- ============================================================================
-- PLATFORM API KEYS: Allow admins to view all platform API keys
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'platform_api_keys') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'platform_api_keys'
      AND policyname = 'Admins can view all platform api keys'
    ) THEN
      CREATE POLICY "Admins can view all platform api keys"
      ON public.platform_api_keys
      FOR SELECT
      TO authenticated
      USING (public.is_admin());
    END IF;
  END IF;
END $$;

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Migration complete: Admin RLS policies for chatbot tables added (skipped existing policies)';
END $$;
