-- Migration: Create user_notifications table
-- Purpose: In-app notification system with Supabase Realtime support

-- ===================================================================
-- PART 1: Create user_notifications table
-- ===================================================================

CREATE TABLE IF NOT EXISTS public.user_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Notification Content
    type TEXT NOT NULL, -- 'job_complete', 'job_failed', 'job_progress', 'social_posted', 'social_failed'
    title TEXT NOT NULL,
    message TEXT NOT NULL,

    -- Additional Context (JSON for flexibility)
    data JSONB DEFAULT '{}'::jsonb,
    -- Example data: { "job_id": "uuid", "collection_id": "uuid", "image_count": 25, "platform": "instagram" }

    -- Status
    is_read BOOLEAN DEFAULT false,

    -- Link to related content
    action_url TEXT, -- e.g., "/images-studio?collection=uuid"

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON user_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON user_notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON user_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON user_notifications(type);

-- ===================================================================
-- PART 2: Enable Row Level Security
-- ===================================================================

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own notifications"
    ON public.user_notifications FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
    ON public.user_notifications FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications"
    ON public.user_notifications FOR DELETE
    USING (auth.uid() = user_id);

-- Service role can create notifications (for edge functions)
CREATE POLICY "Service role can create notifications"
    ON public.user_notifications FOR INSERT
    WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Also allow authenticated users to insert (for client-side testing)
CREATE POLICY "Users can create own notifications"
    ON public.user_notifications FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- ===================================================================
-- PART 3: Enable Realtime for notifications
-- ===================================================================

-- Enable Realtime on the table
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_notifications;

-- ===================================================================
-- PART 4: Helper function to create notifications
-- ===================================================================

CREATE OR REPLACE FUNCTION create_notification(
    p_user_id UUID,
    p_type TEXT,
    p_title TEXT,
    p_message TEXT,
    p_data JSONB DEFAULT '{}'::jsonb,
    p_action_url TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    notification_id UUID;
BEGIN
    INSERT INTO user_notifications (user_id, type, title, message, data, action_url)
    VALUES (p_user_id, p_type, p_title, p_message, p_data, p_action_url)
    RETURNING id INTO notification_id;

    RETURN notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===================================================================
-- PART 5: Function to mark all notifications as read
-- ===================================================================

CREATE OR REPLACE FUNCTION mark_all_notifications_read(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    UPDATE user_notifications
    SET is_read = true
    WHERE user_id = p_user_id AND is_read = false;

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===================================================================
-- PART 6: Function to get unread notification count
-- ===================================================================

CREATE OR REPLACE FUNCTION get_unread_notification_count(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    count_result INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO count_result
    FROM user_notifications
    WHERE user_id = p_user_id AND is_read = false;

    RETURN count_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===================================================================
-- PART 7: Trigger to create notification when advertising job completes
-- ===================================================================

CREATE OR REPLACE FUNCTION notify_on_job_completion()
RETURNS TRIGGER AS $$
BEGIN
    -- Only trigger on status change to completed or failed
    IF (OLD.status IS DISTINCT FROM NEW.status) AND NEW.status IN ('completed', 'failed') THEN
        IF NEW.status = 'completed' THEN
            INSERT INTO user_notifications (user_id, type, title, message, data, action_url)
            VALUES (
                NEW.user_id,
                'job_complete',
                'Images Ready!',
                format('%s advertising images have been generated and saved to your gallery.', NEW.completed_images),
                jsonb_build_object(
                    'job_id', NEW.id,
                    'collection_id', NEW.collection_id,
                    'total_images', NEW.total_images,
                    'completed_images', NEW.completed_images,
                    'failed_images', NEW.failed_images,
                    'group_name', NEW.group_name
                ),
                format('/images-studio?collection=%s', NEW.collection_id)
            );
        ELSE
            INSERT INTO user_notifications (user_id, type, title, message, data, action_url)
            VALUES (
                NEW.user_id,
                'job_failed',
                'Image Generation Issue',
                CASE
                    WHEN NEW.completed_images > 0 THEN
                        format('%s of %s images generated. Some images failed.', NEW.completed_images, NEW.total_images)
                    ELSE
                        'Image generation failed. Please try again.'
                END,
                jsonb_build_object(
                    'job_id', NEW.id,
                    'collection_id', NEW.collection_id,
                    'total_images', NEW.total_images,
                    'completed_images', NEW.completed_images,
                    'failed_images', NEW.failed_images,
                    'error_message', NEW.error_message
                ),
                '/images-studio'
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on advertising_jobs
CREATE TRIGGER advertising_job_completion_notification
    AFTER UPDATE OF status ON advertising_jobs
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_job_completion();

-- ===================================================================
-- PART 8: Auto-cleanup old notifications (optional)
-- ===================================================================

-- Function to clean up notifications older than 30 days
CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM user_notifications
    WHERE created_at < NOW() - INTERVAL '30 days';

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ===================================================================
-- Comments
-- ===================================================================

COMMENT ON TABLE user_notifications IS 'In-app notifications for users with Realtime support';
COMMENT ON COLUMN user_notifications.type IS 'Notification type: job_complete, job_failed, social_posted, etc.';
COMMENT ON COLUMN user_notifications.data IS 'Additional context data as JSON (job_id, collection_id, etc.)';
COMMENT ON COLUMN user_notifications.action_url IS 'URL to navigate when notification is clicked';
COMMENT ON FUNCTION create_notification IS 'Helper to create notifications from edge functions';
COMMENT ON FUNCTION mark_all_notifications_read IS 'Mark all notifications as read for a user';
