-- Fix existing advertising jobs by recalculating progress
-- Run this AFTER applying fix_advertising_progress_trigger.sql

-- Update all existing jobs with correct progress
UPDATE advertising_jobs aj
SET
    completed_images = (
        SELECT COUNT(*) FROM advertising_job_items
        WHERE job_id = aj.id AND status = 'completed'
    ),
    failed_images = (
        SELECT COUNT(*) FROM advertising_job_items
        WHERE job_id = aj.id AND status = 'failed'
    ),
    progress = LEAST(100, (
        (SELECT COUNT(*) FROM advertising_job_items WHERE job_id = aj.id AND status IN ('completed', 'failed')) * 100
    ) / NULLIF(aj.total_images, 0)),
    status = CASE
        WHEN (SELECT COUNT(*) FROM advertising_job_items WHERE job_id = aj.id AND status IN ('completed', 'failed')) >= aj.total_images
        THEN CASE
            WHEN (SELECT COUNT(*) FROM advertising_job_items WHERE job_id = aj.id AND status = 'failed') = aj.total_images THEN 'failed'
            WHEN (SELECT COUNT(*) FROM advertising_job_items WHERE job_id = aj.id AND status = 'failed') > 0 THEN 'partial'
            ELSE 'completed'
        END
        ELSE aj.status
    END,
    completed_at = CASE
        WHEN (SELECT COUNT(*) FROM advertising_job_items WHERE job_id = aj.id AND status IN ('completed', 'failed')) >= aj.total_images
        THEN COALESCE(aj.completed_at, NOW())
        ELSE aj.completed_at
    END;

-- View results
SELECT
    id,
    group_name,
    status,
    progress,
    completed_images,
    failed_images,
    total_images
FROM advertising_jobs
ORDER BY created_at DESC
LIMIT 10;
