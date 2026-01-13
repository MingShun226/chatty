-- Find stuck jobs and reset pending items for retry
-- Run this in Supabase SQL Editor

-- First, see what jobs are stuck
SELECT
  id,
  group_name,
  status,
  total_images,
  completed_images,
  failed_images,
  progress,
  created_at
FROM advertising_jobs
WHERE status IN ('pending', 'generating')
ORDER BY created_at DESC
LIMIT 5;

-- Reset any "processing" items back to "pending" so they can be retried
-- (Items stuck in processing state due to timeout)
UPDATE advertising_job_items
SET status = 'pending', started_at = NULL
WHERE status = 'processing'
  AND started_at < NOW() - INTERVAL '5 minutes';

-- Check which items need processing
SELECT
  aji.id,
  aji.style_name,
  aji.status,
  aji.retry_count,
  aji.error_message,
  aj.group_name
FROM advertising_job_items aji
JOIN advertising_jobs aj ON aj.id = aji.job_id
WHERE aj.status IN ('pending', 'generating')
  AND aji.status IN ('pending', 'processing')
ORDER BY aj.created_at DESC, aji.created_at ASC;
