# Fix: Collections Not Showing Images

## Problem
Collections show "0 images" even though KIE.AI successfully generated images.

## Root Cause
The `generated_images` table needs the `collection_id` column added by the advertising jobs migration.

## Solution Steps

### Step 1: Apply the Migration
Run this SQL in the Supabase SQL Editor to add the required columns:

```sql
-- Add columns to generated_images if they don't exist
ALTER TABLE public.generated_images
ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES public.advertising_jobs(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS collection_id UUID REFERENCES public.image_collections(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS style_id TEXT,
ADD COLUMN IF NOT EXISTS platform TEXT;

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_generated_images_job_id ON generated_images(job_id);
CREATE INDEX IF NOT EXISTS idx_generated_images_collection_id ON generated_images(collection_id);
```

### Step 2: Deploy the Edge Function
Redeploy the edge function to ensure the latest code is running:

```bash
npx supabase functions deploy process-advertising-job --no-verify-jwt
```

### Step 3: Verify the Fix
1. Generate a new batch of images using the AI Wizard
2. Check the browser console for debug logs:
   - `[useImageCollections] Collections found: X`
   - `[useImageCollections] Images found with collection_id: X`
3. The batch view should now show images in their collections

### Debugging
Run this SQL to check if images have collection_id set:

```sql
-- Check recent images and their collection_id
SELECT
  gi.id,
  gi.collection_id,
  gi.job_id,
  gi.platform,
  gi.created_at,
  LEFT(gi.prompt, 50) as prompt_preview
FROM generated_images gi
WHERE gi.created_at > NOW() - INTERVAL '24 hours'
ORDER BY gi.created_at DESC
LIMIT 20;

-- Check if collections have linked images
SELECT
  ic.name,
  ic.created_at,
  COUNT(gi.id) as image_count
FROM image_collections ic
LEFT JOIN generated_images gi ON gi.collection_id = ic.id
WHERE ic.created_at > NOW() - INTERVAL '24 hours'
GROUP BY ic.id, ic.name, ic.created_at
ORDER BY ic.created_at DESC;
```

## What Was Fixed in Code

1. **useImageCollections.ts**: Now queries images directly from `generated_images` using `collection_id` instead of the junction table
2. **useAdvertisingJobs.ts**: Now invalidates collections and gallery queries when a job completes
3. **process-advertising-job edge function**: Already saves images with `collection_id`

## Notes
- The junction table `image_collection_items` is no longer used for the primary query
- Images are linked to collections directly via `generated_images.collection_id`
- The realtime subscription auto-refreshes the gallery when jobs complete
