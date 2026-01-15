-- Add missing columns to avatar_knowledge_files for RAG processing
-- and create document_chunks table for storing embeddings

-- ==============================================================
-- Part 1: Add missing columns to avatar_knowledge_files
-- ==============================================================

-- Add processing_status column (tracks RAG processing state)
ALTER TABLE public.avatar_knowledge_files
ADD COLUMN IF NOT EXISTS processing_status TEXT DEFAULT 'pending';

-- Add check constraint separately (safer for existing data)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'avatar_knowledge_files_processing_status_check'
  ) THEN
    ALTER TABLE public.avatar_knowledge_files
    ADD CONSTRAINT avatar_knowledge_files_processing_status_check
    CHECK (processing_status IN ('pending', 'processing', 'processed', 'error'));
  END IF;
END $$;

-- Add original_name column (stores the original uploaded filename)
ALTER TABLE public.avatar_knowledge_files
ADD COLUMN IF NOT EXISTS original_name TEXT;

-- Add extracted_text column (stores extracted text preview from PDFs)
ALTER TABLE public.avatar_knowledge_files
ADD COLUMN IF NOT EXISTS extracted_text TEXT;

-- Add shareable column (whether document can be shared with customers)
ALTER TABLE public.avatar_knowledge_files
ADD COLUMN IF NOT EXISTS shareable BOOLEAN DEFAULT false;

-- Update existing records to have original_name set from file_name if null
UPDATE public.avatar_knowledge_files
SET original_name = file_name
WHERE original_name IS NULL;

-- Create index for processing_status lookups
CREATE INDEX IF NOT EXISTS idx_knowledge_files_processing_status
ON public.avatar_knowledge_files(processing_status);

-- Create index for shareable documents
CREATE INDEX IF NOT EXISTS idx_knowledge_files_shareable
ON public.avatar_knowledge_files(shareable) WHERE shareable = true;

-- ==============================================================
-- Part 2: Create document_chunks table for RAG embeddings
-- ==============================================================

CREATE TABLE IF NOT EXISTS public.document_chunks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  knowledge_file_id UUID NOT NULL REFERENCES public.avatar_knowledge_files(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  avatar_id UUID NOT NULL REFERENCES public.avatars(id) ON DELETE CASCADE,
  chunk_text TEXT NOT NULL,
  chunk_index INTEGER NOT NULL DEFAULT 0,
  chunk_size INTEGER,
  page_number INTEGER,
  section_title TEXT,
  chunk_type TEXT DEFAULT 'content',
  embedding JSONB, -- Store embeddings as JSONB (array of floats)
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on document_chunks
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for document_chunks
DO $$
BEGIN
  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS "Users can view their own document chunks" ON public.document_chunks;
  DROP POLICY IF EXISTS "Users can create their own document chunks" ON public.document_chunks;
  DROP POLICY IF EXISTS "Users can update their own document chunks" ON public.document_chunks;
  DROP POLICY IF EXISTS "Users can delete their own document chunks" ON public.document_chunks;

  -- Create new policies
  CREATE POLICY "Users can view their own document chunks"
    ON public.document_chunks FOR SELECT
    USING (auth.uid() = user_id);

  CREATE POLICY "Users can create their own document chunks"
    ON public.document_chunks FOR INSERT
    WITH CHECK (auth.uid() = user_id);

  CREATE POLICY "Users can update their own document chunks"
    ON public.document_chunks FOR UPDATE
    USING (auth.uid() = user_id);

  CREATE POLICY "Users can delete their own document chunks"
    ON public.document_chunks FOR DELETE
    USING (auth.uid() = user_id);
END $$;

-- Create indexes for document_chunks
CREATE INDEX IF NOT EXISTS idx_document_chunks_knowledge_file_id
ON public.document_chunks(knowledge_file_id);

CREATE INDEX IF NOT EXISTS idx_document_chunks_user_avatar
ON public.document_chunks(user_id, avatar_id);

CREATE INDEX IF NOT EXISTS idx_document_chunks_chunk_index
ON public.document_chunks(knowledge_file_id, chunk_index);

-- ==============================================================
-- Part 3: Create rag_search_logs table for analytics
-- ==============================================================

CREATE TABLE IF NOT EXISTS public.rag_search_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  avatar_id UUID NOT NULL REFERENCES public.avatars(id) ON DELETE CASCADE,
  query_text TEXT NOT NULL,
  query_embedding JSONB,
  chunks_found INTEGER DEFAULT 0,
  top_similarity_score FLOAT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on rag_search_logs
ALTER TABLE public.rag_search_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for rag_search_logs
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view their own search logs" ON public.rag_search_logs;
  DROP POLICY IF EXISTS "Users can create their own search logs" ON public.rag_search_logs;

  CREATE POLICY "Users can view their own search logs"
    ON public.rag_search_logs FOR SELECT
    USING (auth.uid() = user_id);

  CREATE POLICY "Users can create their own search logs"
    ON public.rag_search_logs FOR INSERT
    WITH CHECK (auth.uid() = user_id);
END $$;

-- Create index for rag_search_logs
CREATE INDEX IF NOT EXISTS idx_rag_search_logs_user_avatar
ON public.rag_search_logs(user_id, avatar_id);

-- ==============================================================
-- Part 4: Add comments for documentation
-- ==============================================================

COMMENT ON COLUMN public.avatar_knowledge_files.processing_status IS 'RAG processing status: pending, processing, processed, error';
COMMENT ON COLUMN public.avatar_knowledge_files.original_name IS 'Original filename as uploaded by user';
COMMENT ON COLUMN public.avatar_knowledge_files.extracted_text IS 'Preview of extracted text from document (first ~5000 chars)';
COMMENT ON COLUMN public.avatar_knowledge_files.shareable IS 'Whether this document can be shared with customers in chat';

COMMENT ON TABLE public.document_chunks IS 'Stores text chunks and embeddings for RAG retrieval';
COMMENT ON TABLE public.rag_search_logs IS 'Logs RAG search queries for analytics';

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Migration complete:';
  RAISE NOTICE '  + Added columns to avatar_knowledge_files: processing_status, original_name, extracted_text, shareable';
  RAISE NOTICE '  + Created document_chunks table for RAG embeddings';
  RAISE NOTICE '  + Created rag_search_logs table for analytics';
END $$;
