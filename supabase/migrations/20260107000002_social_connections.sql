-- Migration: Create social_connections and social_posts tables
-- Purpose: Enable Instagram and TikTok OAuth integration and direct posting

-- ===================================================================
-- PART 1: Create social_connections table for OAuth tokens
-- ===================================================================

CREATE TABLE IF NOT EXISTS public.social_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Platform Info
    platform TEXT NOT NULL CHECK (platform IN ('instagram', 'tiktok', 'facebook')),

    -- OAuth Tokens (encrypted)
    access_token_encrypted TEXT NOT NULL,
    refresh_token_encrypted TEXT,
    token_expires_at TIMESTAMPTZ,

    -- Account Information
    account_id TEXT NOT NULL, -- Platform's user/account ID
    account_username TEXT,
    account_name TEXT, -- Display name
    profile_picture_url TEXT,
    follower_count INTEGER,

    -- Platform-specific data
    platform_data JSONB DEFAULT '{}'::jsonb,
    -- Instagram: { "instagram_business_account_id": "...", "page_id": "..." }
    -- TikTok: { "open_id": "...", "union_id": "..." }

    -- Permissions/Scopes
    permissions TEXT[], -- Granted OAuth scopes

    -- Status
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked', 'error')),
    last_error TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,

    -- Unique constraint: one connection per platform per account per user
    UNIQUE(user_id, platform, account_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_social_connections_user_id ON social_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_social_connections_platform ON social_connections(user_id, platform);
CREATE INDEX IF NOT EXISTS idx_social_connections_status ON social_connections(status);

-- ===================================================================
-- PART 2: Create social_posts table for tracking posted content
-- ===================================================================

CREATE TABLE IF NOT EXISTS public.social_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    connection_id UUID NOT NULL REFERENCES public.social_connections(id) ON DELETE CASCADE,
    image_id UUID REFERENCES public.generated_images(id) ON DELETE SET NULL,

    -- Platform Info
    platform TEXT NOT NULL,

    -- Post Content
    caption TEXT,
    hashtags TEXT[],

    -- Post Result
    post_id TEXT, -- Platform's post ID
    post_url TEXT, -- URL to view the post
    post_type TEXT DEFAULT 'image' CHECK (post_type IN ('image', 'carousel', 'video', 'story', 'reel')),

    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'posting', 'posted', 'failed', 'deleted')),
    error_message TEXT,

    -- Engagement (can be updated later)
    likes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    shares_count INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    scheduled_at TIMESTAMPTZ, -- For future scheduled posting feature
    posted_at TIMESTAMPTZ
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_social_posts_user_id ON social_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_connection_id ON social_posts(connection_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_platform ON social_posts(platform);
CREATE INDEX IF NOT EXISTS idx_social_posts_status ON social_posts(status);
CREATE INDEX IF NOT EXISTS idx_social_posts_image_id ON social_posts(image_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_posted_at ON social_posts(posted_at DESC);

-- ===================================================================
-- PART 3: Enable Row Level Security
-- ===================================================================

ALTER TABLE public.social_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for social_connections
CREATE POLICY "Users can view own social connections"
    ON public.social_connections FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own social connections"
    ON public.social_connections FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own social connections"
    ON public.social_connections FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own social connections"
    ON public.social_connections FOR DELETE
    USING (auth.uid() = user_id);

-- Service role full access for edge functions
CREATE POLICY "Service role full access to social_connections"
    ON public.social_connections FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- RLS Policies for social_posts
CREATE POLICY "Users can view own social posts"
    ON public.social_posts FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own social posts"
    ON public.social_posts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own social posts"
    ON public.social_posts FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own social posts"
    ON public.social_posts FOR DELETE
    USING (auth.uid() = user_id);

-- Service role full access for edge functions
CREATE POLICY "Service role full access to social_posts"
    ON public.social_posts FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- ===================================================================
-- PART 4: Create triggers for timestamp updates
-- ===================================================================

CREATE TRIGGER social_connections_updated_at
    BEFORE UPDATE ON social_connections
    FOR EACH ROW
    EXECUTE FUNCTION update_advertising_job_updated_at();

-- ===================================================================
-- PART 5: Helper functions for token encryption
-- ===================================================================

-- Simple base64 encoding for tokens (should be upgraded to proper encryption)
CREATE OR REPLACE FUNCTION encrypt_token(token TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN encode(convert_to(token, 'UTF8'), 'base64');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION decrypt_token(encrypted_token TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN convert_from(decode(encrypted_token, 'base64'), 'UTF8');
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===================================================================
-- PART 6: Function to check if token needs refresh
-- ===================================================================

CREATE OR REPLACE FUNCTION check_token_expiry()
RETURNS TRIGGER AS $$
BEGIN
    -- If token is about to expire (within 1 hour), mark as expired
    IF NEW.token_expires_at IS NOT NULL AND NEW.token_expires_at < NOW() + INTERVAL '1 hour' THEN
        NEW.status := 'expired';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_token_on_update
    BEFORE UPDATE ON social_connections
    FOR EACH ROW
    EXECUTE FUNCTION check_token_expiry();

-- ===================================================================
-- PART 7: Create notification for successful posts
-- ===================================================================

CREATE OR REPLACE FUNCTION notify_on_social_post()
RETURNS TRIGGER AS $$
BEGIN
    -- Only notify when status changes to posted or failed
    IF (OLD.status IS DISTINCT FROM NEW.status) AND NEW.status IN ('posted', 'failed') THEN
        IF NEW.status = 'posted' THEN
            INSERT INTO user_notifications (user_id, type, title, message, data, action_url)
            VALUES (
                NEW.user_id,
                'social_posted',
                format('Posted to %s!', initcap(NEW.platform)),
                'Your image has been successfully posted.',
                jsonb_build_object(
                    'post_id', NEW.id,
                    'platform', NEW.platform,
                    'post_url', NEW.post_url
                ),
                NEW.post_url
            );
        ELSE
            INSERT INTO user_notifications (user_id, type, title, message, data, action_url)
            VALUES (
                NEW.user_id,
                'social_failed',
                format('Failed to post to %s', initcap(NEW.platform)),
                COALESCE(NEW.error_message, 'An error occurred while posting.'),
                jsonb_build_object(
                    'post_id', NEW.id,
                    'platform', NEW.platform,
                    'error', NEW.error_message
                ),
                '/images-studio'
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER social_post_notification
    AFTER UPDATE OF status ON social_posts
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_social_post();

-- ===================================================================
-- PART 8: View for connection status summary
-- ===================================================================

CREATE OR REPLACE VIEW social_connection_summary AS
SELECT
    user_id,
    platform,
    COUNT(*) as connection_count,
    COUNT(*) FILTER (WHERE status = 'active') as active_count,
    MAX(last_used_at) as last_used,
    ARRAY_AGG(account_username) as usernames
FROM social_connections
GROUP BY user_id, platform;

-- ===================================================================
-- Comments
-- ===================================================================

COMMENT ON TABLE social_connections IS 'OAuth connections to Instagram, TikTok, and Facebook';
COMMENT ON TABLE social_posts IS 'Track all content posted to social media platforms';
COMMENT ON COLUMN social_connections.access_token_encrypted IS 'Base64 encoded OAuth access token';
COMMENT ON COLUMN social_connections.platform_data IS 'Platform-specific data like page IDs, business account IDs';
COMMENT ON COLUMN social_posts.post_type IS 'Type of post: image, carousel, video, story, reel';
COMMENT ON COLUMN social_posts.scheduled_at IS 'For future scheduled posting feature';
