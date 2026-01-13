-- Verify that the collection_id column exists on generated_images
-- Run this in Supabase SQL Editor to check the schema

-- Check if columns exist on generated_images
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'generated_images'
  AND column_name IN ('collection_id', 'job_id', 'style_id', 'platform');

-- If the above returns empty, run this to add the columns:
-- ALTER TABLE public.generated_images
-- ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES public.advertising_jobs(id) ON DELETE SET NULL,
-- ADD COLUMN IF NOT EXISTS collection_id UUID REFERENCES public.image_collections(id) ON DELETE SET NULL,
-- ADD COLUMN IF NOT EXISTS style_id TEXT,
-- ADD COLUMN IF NOT EXISTS platform TEXT;

-- CREATE INDEX IF NOT EXISTS idx_generated_images_job_id ON generated_images(job_id);
-- CREATE INDEX IF NOT EXISTS idx_generated_images_collection_id ON generated_images(collection_id);

-- Check for images that should be linked to collections
SELECT
  gi.id,
  gi.collection_id,
  gi.job_id,
  gi.platform,
  gi.style_id,
  gi.created_at,
  LEFT(gi.prompt, 50) as prompt_preview
FROM generated_images gi
WHERE gi.created_at > NOW() - INTERVAL '24 hours'
ORDER BY gi.created_at DESC
LIMIT 20;

-- Check collections and their linked images
SELECT
  ic.id as collection_id,
  ic.name,
  ic.created_at,
  COUNT(gi.id) as image_count
FROM image_collections ic
LEFT JOIN generated_images gi ON gi.collection_id = ic.id
WHERE ic.created_at > NOW() - INTERVAL '24 hours'
GROUP BY ic.id, ic.name, ic.created_at
ORDER BY ic.created_at DESC;
