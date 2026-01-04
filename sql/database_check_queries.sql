-- ============================================================================
-- DATABASE CHECK QUERIES
-- Use these in your Supabase SQL Editor to verify what's stored
-- ============================================================================

-- 1. CHECK YOUR CHATBOT DATA
-- This shows the chatbot you just created with all business information
SELECT
  id,
  name,
  chatbot_type,
  industry,
  company_name,
  business_context,
  default_language,
  supported_languages,
  array_length(compliance_rules, 1) as compliance_rules_count,
  array_length(response_guidelines, 1) as guidelines_count,
  created_at
FROM avatars
WHERE chatbot_type = 'business'
ORDER BY created_at DESC
LIMIT 5;

-- ============================================================================

-- 2. CHECK KNOWLEDGE BASE FILES (Supabase Storage)
-- This checks if any files were uploaded to the knowledge_base bucket
SELECT
  name,
  bucket_id,
  created_at,
  (metadata->>'size')::bigint / 1024 as size_kb,
  metadata->>'mimetype' as file_type
FROM storage.objects
WHERE bucket_id = 'knowledge_base'
ORDER BY created_at DESC
LIMIT 10;

-- ============================================================================

-- 3. CHECK PRODUCTS TABLE
-- This checks if any products were imported from Excel
SELECT
  COUNT(*) as total_products,
  COUNT(DISTINCT chatbot_id) as chatbots_with_products
FROM chatbot_products;

-- Get products for your chatbot (replace YOUR_CHATBOT_ID with actual ID)
SELECT
  sku,
  product_name,
  price,
  category,
  stock_quantity,
  in_stock,
  created_at
FROM chatbot_products
WHERE chatbot_id = 'YOUR_CHATBOT_ID'
ORDER BY created_at DESC
LIMIT 10;

-- ============================================================================

-- 4. CHECK KNOWLEDGE BASE CHUNKS (Vector Embeddings)
-- This checks if PDFs were processed and embedded
SELECT
  COUNT(*) as total_chunks,
  COUNT(DISTINCT chatbot_id) as chatbots_with_knowledge
FROM knowledge_base;

-- Get knowledge chunks for your chatbot
SELECT
  id,
  chatbot_id,
  LENGTH(content) as content_length,
  source_file,
  created_at
FROM knowledge_base
WHERE chatbot_id = 'YOUR_CHATBOT_ID'
ORDER BY created_at DESC
LIMIT 5;

-- ============================================================================

-- 5. CHECK EXCEL UPLOAD JOBS
-- This checks if Excel import was tracked
SELECT
  id,
  chatbot_id,
  filename,
  total_rows,
  successful_imports,
  failed_imports,
  status,
  created_at
FROM chatbot_product_uploads
ORDER BY created_at DESC
LIMIT 5;

-- ============================================================================

-- 6. QUICK SUMMARY OF YOUR CHATBOT
-- Replace YOUR_CHATBOT_ID with the actual ID from query #1
WITH chatbot_info AS (
  SELECT id, name, company_name FROM avatars WHERE id = 'YOUR_CHATBOT_ID'
),
product_count AS (
  SELECT COUNT(*) as count FROM chatbot_products WHERE chatbot_id = 'YOUR_CHATBOT_ID'
),
knowledge_count AS (
  SELECT COUNT(*) as count FROM knowledge_base WHERE chatbot_id = 'YOUR_CHATBOT_ID'
)
SELECT
  c.name as chatbot_name,
  c.company_name,
  p.count as products_count,
  k.count as knowledge_chunks
FROM chatbot_info c
CROSS JOIN product_count p
CROSS JOIN knowledge_count k;

-- ============================================================================
-- HOW TO USE:
-- 1. Copy these queries one by one
-- 2. Paste into Supabase SQL Editor
-- 3. Run each query to check your data
-- ============================================================================
