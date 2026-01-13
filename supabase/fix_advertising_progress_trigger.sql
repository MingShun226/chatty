-- Quick fix: Add the missing trigger to update job progress
-- Run this in Supabase Dashboard SQL Editor

-- Drop existing trigger if it exists (to avoid conflicts)
DROP TRIGGER IF EXISTS update_job_progress_on_item_change ON advertising_job_items;

-- Create or replace the progress update function
CREATE OR REPLACE FUNCTION update_advertising_job_progress()
RETURNS TRIGGER AS $$
DECLARE
    job_total INTEGER;
    job_completed INTEGER;
    job_failed INTEGER;
    new_progress INTEGER;
    new_status TEXT;
BEGIN
    -- Get current counts
    SELECT
        total_images,
        (SELECT COUNT(*) FROM advertising_job_items WHERE job_id = NEW.job_id AND status = 'completed'),
        (SELECT COUNT(*) FROM advertising_job_items WHERE job_id = NEW.job_id AND status = 'failed')
    INTO job_total, job_completed, job_failed
    FROM advertising_jobs
    WHERE id = NEW.job_id;

    -- Calculate progress
    new_progress := LEAST(100, ((job_completed + job_failed) * 100) / NULLIF(job_total, 0));

    -- Determine job status
    IF job_completed + job_failed >= job_total THEN
        IF job_failed = job_total THEN
            new_status := 'failed';
        ELSIF job_failed > 0 THEN
            new_status := 'partial';
        ELSE
            new_status := 'completed';
        END IF;
    ELSE
        new_status := 'generating';
    END IF;

    -- Update job
    UPDATE advertising_jobs
    SET
        progress = new_progress,
        completed_images = job_completed,
        failed_images = job_failed,
        status = new_status,
        completed_at = CASE WHEN new_status IN ('completed', 'failed', 'partial') THEN NOW() ELSE NULL END
    WHERE id = NEW.job_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-update job progress when items change
CREATE TRIGGER update_job_progress_on_item_change
    AFTER UPDATE OF status ON advertising_job_items
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION update_advertising_job_progress();

-- Also add trigger for INSERT (when items are first created with completed status)
DROP TRIGGER IF EXISTS update_job_progress_on_item_insert ON advertising_job_items;
CREATE TRIGGER update_job_progress_on_item_insert
    AFTER INSERT ON advertising_job_items
    FOR EACH ROW
    WHEN (NEW.status IN ('completed', 'failed'))
    EXECUTE FUNCTION update_advertising_job_progress();

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION update_advertising_job_progress() TO service_role;

-- Verify: Check if triggers exist
SELECT tgname, tgrelid::regclass, tgenabled
FROM pg_trigger
WHERE tgname LIKE '%job_progress%';
