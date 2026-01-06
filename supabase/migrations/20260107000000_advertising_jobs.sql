-- Migration: Create advertising_jobs and advertising_job_items tables
-- Purpose: Enable background processing of batch advertising image generation

-- ===================================================================
-- PART 1: Create advertising_jobs table for tracking batch generation jobs
-- ===================================================================

CREATE TABLE IF NOT EXISTS public.advertising_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    collection_id UUID REFERENCES public.image_collections(id) ON DELETE SET NULL,

    -- Job Status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'analyzing', 'generating', 'completed', 'failed', 'cancelled')),
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),

    -- Image Counts
    total_images INTEGER NOT NULL CHECK (total_images > 0),
    completed_images INTEGER DEFAULT 0 CHECK (completed_images >= 0),
    failed_images INTEGER DEFAULT 0 CHECK (failed_images >= 0),

    -- Input Data
    input_image_url TEXT NOT NULL,
    product_analysis JSONB, -- Stored product analysis result

    -- Style Configuration
    recommended_styles JSONB, -- AI recommended styles with scores
    selected_styles JSONB NOT NULL, -- User confirmed styles to generate
    image_quality TEXT DEFAULT '2K' CHECK (image_quality IN ('1K', '2K', '4K')),

    -- Group/Collection Settings
    group_name TEXT NOT NULL, -- Auto-generated name like "Product Ads - Jan 6, 2026"

    -- Error Handling
    error_message TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ, -- When processing started
    completed_at TIMESTAMPTZ -- When all images finished
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_advertising_jobs_user_id ON advertising_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_advertising_jobs_status ON advertising_jobs(status);
CREATE INDEX IF NOT EXISTS idx_advertising_jobs_user_status ON advertising_jobs(user_id, status);
CREATE INDEX IF NOT EXISTS idx_advertising_jobs_created_at ON advertising_jobs(created_at DESC);

-- ===================================================================
-- PART 2: Create advertising_job_items table for individual image tasks
-- ===================================================================

CREATE TABLE IF NOT EXISTS public.advertising_job_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES public.advertising_jobs(id) ON DELETE CASCADE,

    -- Style Information
    style_id TEXT NOT NULL,
    style_name TEXT NOT NULL,
    platform TEXT NOT NULL, -- shopee, lazada, instagram, tiktok, facebook, temu
    series_number INTEGER, -- 1-5 for series position

    -- Processing Status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    task_id TEXT, -- External API task ID (KIE.AI)
    retry_count INTEGER DEFAULT 0 CHECK (retry_count >= 0 AND retry_count <= 3),

    -- Result
    generated_image_id UUID REFERENCES public.generated_images(id) ON DELETE SET NULL,
    image_url TEXT, -- Direct URL to generated image

    -- Error Handling
    error_message TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_job_items_job_id ON advertising_job_items(job_id);
CREATE INDEX IF NOT EXISTS idx_job_items_status ON advertising_job_items(status);
CREATE INDEX IF NOT EXISTS idx_job_items_task_id ON advertising_job_items(task_id);
CREATE INDEX IF NOT EXISTS idx_job_items_job_status ON advertising_job_items(job_id, status);

-- ===================================================================
-- PART 3: Add job_id column to generated_images for linking
-- ===================================================================

ALTER TABLE public.generated_images
ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES public.advertising_jobs(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS collection_id UUID REFERENCES public.image_collections(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS style_id TEXT,
ADD COLUMN IF NOT EXISTS platform TEXT;

-- Create index for job queries
CREATE INDEX IF NOT EXISTS idx_generated_images_job_id ON generated_images(job_id);
CREATE INDEX IF NOT EXISTS idx_generated_images_collection_id ON generated_images(collection_id);

-- ===================================================================
-- PART 4: Enable Row Level Security
-- ===================================================================

ALTER TABLE public.advertising_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advertising_job_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for advertising_jobs
CREATE POLICY "Users can view own advertising jobs"
    ON public.advertising_jobs FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own advertising jobs"
    ON public.advertising_jobs FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own advertising jobs"
    ON public.advertising_jobs FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own advertising jobs"
    ON public.advertising_jobs FOR DELETE
    USING (auth.uid() = user_id);

-- RLS Policies for advertising_job_items (through job ownership)
CREATE POLICY "Users can view own job items"
    ON public.advertising_job_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.advertising_jobs
            WHERE id = advertising_job_items.job_id
            AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create own job items"
    ON public.advertising_job_items FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.advertising_jobs
            WHERE id = advertising_job_items.job_id
            AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update own job items"
    ON public.advertising_job_items FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.advertising_jobs
            WHERE id = advertising_job_items.job_id
            AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete own job items"
    ON public.advertising_job_items FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.advertising_jobs
            WHERE id = advertising_job_items.job_id
            AND user_id = auth.uid()
        )
    );

-- Service role can do everything (for edge functions)
CREATE POLICY "Service role full access to advertising_jobs"
    ON public.advertising_jobs FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access to job_items"
    ON public.advertising_job_items FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- ===================================================================
-- PART 5: Create triggers for automatic timestamp updates
-- ===================================================================

-- Trigger for advertising_jobs updated_at
CREATE OR REPLACE FUNCTION update_advertising_job_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER advertising_jobs_updated_at
    BEFORE UPDATE ON advertising_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_advertising_job_updated_at();

-- Trigger for advertising_job_items updated_at
CREATE TRIGGER advertising_job_items_updated_at
    BEFORE UPDATE ON advertising_job_items
    FOR EACH ROW
    EXECUTE FUNCTION update_advertising_job_updated_at();

-- ===================================================================
-- PART 6: Create helper function to update job progress
-- ===================================================================

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
        completed_at = CASE WHEN new_status IN ('completed', 'failed') THEN NOW() ELSE NULL END
    WHERE id = NEW.job_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update job progress when items change
CREATE TRIGGER update_job_progress_on_item_change
    AFTER UPDATE OF status ON advertising_job_items
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION update_advertising_job_progress();

-- ===================================================================
-- Comments
-- ===================================================================

COMMENT ON TABLE advertising_jobs IS 'Background jobs for batch advertising image generation';
COMMENT ON TABLE advertising_job_items IS 'Individual image tasks within an advertising job';
COMMENT ON COLUMN advertising_jobs.status IS 'Job status: pending, analyzing, generating, completed, failed, cancelled';
COMMENT ON COLUMN advertising_jobs.recommended_styles IS 'AI-recommended styles with scores and reasoning';
COMMENT ON COLUMN advertising_jobs.selected_styles IS 'Final styles selected by user for generation';
COMMENT ON COLUMN advertising_job_items.task_id IS 'External KIE.AI task ID for polling status';
