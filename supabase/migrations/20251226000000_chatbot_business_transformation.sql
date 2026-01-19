-- ============================================================================
-- BUSINESS CHATBOT PLATFORM TRANSFORMATION - MALAYSIA MARKET
-- ============================================================================
-- Migration Date: December 26, 2025
-- Purpose: Transform avatar platform to business chatbot platform
-- Target Market: Malaysian SMEs and enterprises
-- Languages: English (default), Chinese, Malay
-- ============================================================================

-- ============================================================================
-- 1. ADD BUSINESS COLUMNS TO AVATARS TABLE
-- ============================================================================

ALTER TABLE avatars
ADD COLUMN IF NOT EXISTS chatbot_type VARCHAR DEFAULT 'business',
ADD COLUMN IF NOT EXISTS industry VARCHAR,
ADD COLUMN IF NOT EXISTS company_name VARCHAR,
ADD COLUMN IF NOT EXISTS business_context TEXT,
ADD COLUMN IF NOT EXISTS compliance_rules TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS response_guidelines TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS brand_settings JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS tone_settings JSONB DEFAULT '{"formality": "friendly", "politeness": "high", "language_mixing": true}'::jsonb,
ADD COLUMN IF NOT EXISTS supported_languages TEXT[] DEFAULT '{en,ms,zh}',
ADD COLUMN IF NOT EXISTS default_language VARCHAR DEFAULT 'en';

COMMENT ON COLUMN avatars.chatbot_type IS 'Type of chatbot: business (default)';
COMMENT ON COLUMN avatars.industry IS 'Industry: customer_service, ecommerce, real_estate, appointment';
COMMENT ON COLUMN avatars.company_name IS 'Company/business name';
COMMENT ON COLUMN avatars.business_context IS 'Business description and context (replaces backstory for business use)';
COMMENT ON COLUMN avatars.compliance_rules IS 'Business compliance rules and policies';
COMMENT ON COLUMN avatars.response_guidelines IS 'Guidelines for chatbot responses';
COMMENT ON COLUMN avatars.brand_settings IS 'Brand voice and tone settings';
COMMENT ON COLUMN avatars.tone_settings IS 'Conversation tone configuration';
COMMENT ON COLUMN avatars.supported_languages IS 'Languages chatbot can communicate in: en, ms, zh';
COMMENT ON COLUMN avatars.default_language IS 'Primary language for chatbot';

-- ============================================================================
-- 2. ADD BUSINESS COLUMNS TO AVATAR_PROMPT_VERSIONS TABLE
-- ============================================================================

ALTER TABLE avatar_prompt_versions
ADD COLUMN IF NOT EXISTS compliance_rules TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS response_guidelines TEXT[] DEFAULT '{}';

COMMENT ON COLUMN avatar_prompt_versions.compliance_rules IS 'Compliance rules for this prompt version';
COMMENT ON COLUMN avatar_prompt_versions.response_guidelines IS 'Response guidelines for this version';

-- ============================================================================
-- 3. ADD FEATURES COLUMN TO SUBSCRIPTION_TIERS (for business limits)
-- ============================================================================

ALTER TABLE subscription_tiers
ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN subscription_tiers.features IS 'Business chatbot features: {chatbots, messages_per_month, products_limit, knowledge_files, fine_tuning, etc}';

-- ============================================================================
-- 4. CREATE CHATBOT_TEMPLATES TABLE (INDUSTRY TEMPLATES)
-- ============================================================================

CREATE TABLE IF NOT EXISTS chatbot_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  industry VARCHAR NOT NULL,
  template_name VARCHAR NOT NULL,
  template_name_en VARCHAR NOT NULL,
  template_name_ms VARCHAR,
  template_name_zh VARCHAR,
  description TEXT,
  description_en TEXT,
  description_ms TEXT,
  description_zh TEXT,

  -- Template content (multi-language)
  business_context_template_en TEXT,
  business_context_template_ms TEXT,
  business_context_template_zh TEXT,

  compliance_rules_en TEXT[] DEFAULT '{}',
  compliance_rules_ms TEXT[] DEFAULT '{}',
  compliance_rules_zh TEXT[] DEFAULT '{}',

  response_guidelines_en TEXT[] DEFAULT '{}',
  response_guidelines_ms TEXT[] DEFAULT '{}',
  response_guidelines_zh TEXT[] DEFAULT '{}',

  -- Tone settings
  tone_settings JSONB DEFAULT '{"formality": "friendly", "politeness": "high"}'::jsonb,

  -- Language support
  default_language VARCHAR DEFAULT 'en',
  supported_languages TEXT[] DEFAULT '{en,ms,zh}',

  -- Guidance documents
  required_documents JSONB DEFAULT '[]'::jsonb,

  -- Sample greetings (multi-language)
  sample_greetings_en TEXT[] DEFAULT '{}',
  sample_greetings_ms TEXT[] DEFAULT '{}',
  sample_greetings_zh TEXT[] DEFAULT '{}',

  -- Product features (for e-commerce templates)
  product_features JSONB DEFAULT '{}'::jsonb,

  -- Metadata
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chatbot_templates_industry ON chatbot_templates(industry);
CREATE INDEX IF NOT EXISTS idx_chatbot_templates_active ON chatbot_templates(is_active) WHERE is_active = true;

COMMENT ON TABLE chatbot_templates IS 'Industry-specific chatbot templates for Malaysian businesses';
COMMENT ON COLUMN chatbot_templates.industry IS 'Industry category: customer_service, ecommerce, real_estate, appointment';
COMMENT ON COLUMN chatbot_templates.supported_languages IS 'Languages supported: en (English), ms (Malay), zh (Chinese)';

-- ============================================================================
-- 5. CREATE CHATBOT_PRODUCTS TABLE (PRODUCT CATALOG)
-- ============================================================================

CREATE TABLE IF NOT EXISTS chatbot_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chatbot_id UUID NOT NULL REFERENCES avatars(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Product identification
  sku VARCHAR NOT NULL,
  product_name VARCHAR NOT NULL,
  product_name_en VARCHAR,
  product_name_ms VARCHAR,
  product_name_zh VARCHAR,

  -- Product details
  description TEXT,
  description_en TEXT,
  description_ms TEXT,
  description_zh TEXT,

  -- Pricing
  price DECIMAL(10, 2),
  currency VARCHAR DEFAULT 'MYR',
  original_price DECIMAL(10, 2), -- For discount display

  -- Images
  images TEXT[] DEFAULT '{}',
  primary_image_url TEXT,

  -- Categorization
  category VARCHAR,
  category_en VARCHAR,
  category_ms VARCHAR,
  category_zh VARCHAR,
  tags TEXT[] DEFAULT '{}',

  -- Inventory
  stock_quantity INTEGER DEFAULT 0,
  in_stock BOOLEAN DEFAULT true,
  low_stock_threshold INTEGER DEFAULT 10,

  -- Links
  product_url TEXT,

  -- Additional metadata
  additional_info JSONB DEFAULT '{}'::jsonb,

  -- Status
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Constraints
  UNIQUE(chatbot_id, sku)
);

CREATE INDEX IF NOT EXISTS idx_chatbot_products_chatbot_id ON chatbot_products(chatbot_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_products_user_id ON chatbot_products(user_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_products_sku ON chatbot_products(sku);
CREATE INDEX IF NOT EXISTS idx_chatbot_products_category ON chatbot_products(category);
CREATE INDEX IF NOT EXISTS idx_chatbot_products_active ON chatbot_products(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_chatbot_products_in_stock ON chatbot_products(in_stock) WHERE in_stock = true;

-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_chatbot_products_search
ON chatbot_products USING gin(to_tsvector('english',
  COALESCE(product_name, '') || ' ' ||
  COALESCE(description, '') || ' ' ||
  COALESCE(category, '')
));

COMMENT ON TABLE chatbot_products IS 'Product catalog for e-commerce chatbots';
COMMENT ON COLUMN chatbot_products.currency IS 'Currency code (default: MYR for Malaysia)';
COMMENT ON COLUMN chatbot_products.low_stock_threshold IS 'Alert threshold for low stock';

-- ============================================================================
-- 6. CREATE CHATBOT_PRODUCT_UPLOADS TABLE (EXCEL IMPORT TRACKING)
-- ============================================================================

CREATE TABLE IF NOT EXISTS chatbot_product_uploads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chatbot_id UUID NOT NULL REFERENCES avatars(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- File info
  file_name VARCHAR NOT NULL,
  file_path VARCHAR NOT NULL,
  file_size BIGINT,

  -- Processing stats
  total_rows INTEGER,
  processed_rows INTEGER DEFAULT 0,
  successful_rows INTEGER DEFAULT 0,
  failed_rows INTEGER DEFAULT 0,
  skipped_rows INTEGER DEFAULT 0,

  -- Status
  status VARCHAR DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),

  -- Error tracking
  error_log JSONB DEFAULT '[]'::jsonb,
  error_summary TEXT,

  -- Processing time
  processing_started_at TIMESTAMP,
  processing_completed_at TIMESTAMP,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chatbot_product_uploads_chatbot_id ON chatbot_product_uploads(chatbot_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_product_uploads_user_id ON chatbot_product_uploads(user_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_product_uploads_status ON chatbot_product_uploads(status);

COMMENT ON TABLE chatbot_product_uploads IS 'Track Excel product import jobs';
COMMENT ON COLUMN chatbot_product_uploads.error_log IS 'Array of error objects: [{row, error, sku}]';

-- ============================================================================
-- 7. CREATE CHATBOT_PROMOTIONS TABLE (PROMOTIONAL CAMPAIGNS)
-- ============================================================================

CREATE TABLE IF NOT EXISTS chatbot_promotions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chatbot_id UUID NOT NULL REFERENCES avatars(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Promotion details (multi-language)
  title VARCHAR NOT NULL,
  title_en VARCHAR,
  title_ms VARCHAR,
  title_zh VARCHAR,

  description TEXT,
  description_en TEXT,
  description_ms TEXT,
  description_zh TEXT,

  -- Promo code
  promo_code VARCHAR,
  discount_type VARCHAR CHECK (discount_type IN ('percentage', 'fixed_amount')),
  discount_value DECIMAL(10, 2),

  -- Images
  banner_image_url TEXT,
  thumbnail_url TEXT,

  -- Validity period
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT true,

  -- Terms
  terms_and_conditions TEXT,
  terms_en TEXT,
  terms_ms TEXT,
  terms_zh TEXT,

  -- Usage tracking
  max_uses INTEGER,
  current_uses INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chatbot_promotions_chatbot_id ON chatbot_promotions(chatbot_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_promotions_active ON chatbot_promotions(is_active, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_chatbot_promotions_promo_code ON chatbot_promotions(promo_code);

COMMENT ON TABLE chatbot_promotions IS 'Promotional campaigns and offers';

-- ============================================================================
-- 8. CREATE CHATBOT_ANALYTICS TABLE (USAGE METRICS)
-- ============================================================================

CREATE TABLE IF NOT EXISTS chatbot_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chatbot_id UUID NOT NULL REFERENCES avatars(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Date
  date DATE NOT NULL,

  -- Conversation metrics
  total_conversations INTEGER DEFAULT 0,
  total_messages INTEGER DEFAULT 0,
  total_user_messages INTEGER DEFAULT 0,
  total_bot_messages INTEGER DEFAULT 0,

  -- Performance metrics
  avg_response_time_ms INTEGER DEFAULT 0,

  -- Language breakdown
  messages_by_language JSONB DEFAULT '{}'::jsonb,

  -- Product interactions (for e-commerce)
  product_queries INTEGER DEFAULT 0,
  products_recommended INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Unique constraint
  UNIQUE(chatbot_id, date)
);

CREATE INDEX IF NOT EXISTS idx_chatbot_analytics_chatbot_date ON chatbot_analytics(chatbot_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_chatbot_analytics_user_id ON chatbot_analytics(user_id);

COMMENT ON TABLE chatbot_analytics IS 'Daily analytics aggregation per chatbot';

-- ============================================================================
-- 9. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Chatbot Templates (public read, admin write)
ALTER TABLE chatbot_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active templates" ON chatbot_templates;
CREATE POLICY "Anyone can view active templates"
  ON chatbot_templates FOR SELECT
  USING (is_active = true);

-- Chatbot Products
ALTER TABLE chatbot_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own products" ON chatbot_products;
CREATE POLICY "Users can view their own products"
  ON chatbot_products FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own products" ON chatbot_products;
CREATE POLICY "Users can insert their own products"
  ON chatbot_products FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own products" ON chatbot_products;
CREATE POLICY "Users can update their own products"
  ON chatbot_products FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own products" ON chatbot_products;
CREATE POLICY "Users can delete their own products"
  ON chatbot_products FOR DELETE
  USING (auth.uid() = user_id);

-- Product Uploads
ALTER TABLE chatbot_product_uploads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own uploads" ON chatbot_product_uploads;
CREATE POLICY "Users can view their own uploads"
  ON chatbot_product_uploads FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create uploads" ON chatbot_product_uploads;
CREATE POLICY "Users can create uploads"
  ON chatbot_product_uploads FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their uploads" ON chatbot_product_uploads;
CREATE POLICY "Users can update their uploads"
  ON chatbot_product_uploads FOR UPDATE
  USING (auth.uid() = user_id);

-- Promotions
ALTER TABLE chatbot_promotions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own promotions" ON chatbot_promotions;
CREATE POLICY "Users can view their own promotions"
  ON chatbot_promotions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert promotions" ON chatbot_promotions;
CREATE POLICY "Users can insert promotions"
  ON chatbot_promotions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update promotions" ON chatbot_promotions;
CREATE POLICY "Users can update promotions"
  ON chatbot_promotions FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete promotions" ON chatbot_promotions;
CREATE POLICY "Users can delete promotions"
  ON chatbot_promotions FOR DELETE
  USING (auth.uid() = user_id);

-- Analytics
ALTER TABLE chatbot_analytics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own analytics" ON chatbot_analytics;
CREATE POLICY "Users can view their own analytics"
  ON chatbot_analytics FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================================================
-- 10. FUNCTIONS
-- ============================================================================

-- Function to update product timestamp
CREATE OR REPLACE FUNCTION update_chatbot_product_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_chatbot_product_timestamp ON chatbot_products;
CREATE TRIGGER update_chatbot_product_timestamp
  BEFORE UPDATE ON chatbot_products
  FOR EACH ROW
  EXECUTE FUNCTION update_chatbot_product_timestamp();

-- Function to update promotion timestamp
CREATE OR REPLACE FUNCTION update_chatbot_promotion_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_chatbot_promotion_timestamp ON chatbot_promotions;
CREATE TRIGGER update_chatbot_promotion_timestamp
  BEFORE UPDATE ON chatbot_promotions
  FOR EACH ROW
  EXECUTE FUNCTION update_chatbot_promotion_timestamp();

-- Function to check low stock
CREATE OR REPLACE FUNCTION check_low_stock()
RETURNS TABLE(
  chatbot_id UUID,
  sku VARCHAR,
  product_name VARCHAR,
  stock_quantity INTEGER,
  threshold INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.chatbot_id,
    p.sku,
    p.product_name,
    p.stock_quantity,
    p.low_stock_threshold
  FROM chatbot_products p
  WHERE p.is_active = true
    AND p.stock_quantity <= p.low_stock_threshold
    AND p.stock_quantity > 0
  ORDER BY p.stock_quantity ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 11. SEED DATA - INDUSTRY TEMPLATES (MULTI-LANGUAGE)
-- ============================================================================
-- See next section for template insertions (keeping file manageable)

-- Template 1: Customer Service
INSERT INTO chatbot_templates (
  industry,
  template_name, template_name_en, template_name_ms, template_name_zh,
  description_en, description_ms, description_zh,
  business_context_template_en,
  business_context_template_ms,
  business_context_template_zh,
  compliance_rules_en,
  compliance_rules_ms,
  compliance_rules_zh,
  response_guidelines_en,
  response_guidelines_ms,
  response_guidelines_zh,
  sample_greetings_en,
  sample_greetings_ms,
  sample_greetings_zh,
  tone_settings,
  supported_languages,
  default_language,
  required_documents,
  display_order
) VALUES (
  'customer_service',
  'Customer Support Assistant',
  'Customer Support Assistant',
  'Pembantu Sokongan Pelanggan',
  '客户服务助手',
  'Handle FAQ, troubleshooting, and customer inquiries',
  'Kendalikan soalan lazim, penyelesaian masalah, dan pertanyaan pelanggan',
  '处理常见问题、故障排除和客户查询',
  'You are a helpful customer support assistant for [COMPANY_NAME]. Your role is to answer customer questions quickly and professionally. Always be polite, patient, and empathetic.',
  'Anda adalah pembantu sokongan pelanggan untuk [COMPANY_NAME]. Tugas anda adalah menjawab soalan pelanggan dengan cepat dan profesional. Sentiasa bersikap sopan, sabar, dan prihatin.',
  '您是 [COMPANY_NAME] 的客户服务助手。您的职责是快速、专业地回答客户问题。始终保持礼貌、耐心和同理心。',
  ARRAY[
    'Never promise refunds without checking company policy',
    'Escalate billing disputes to human staff immediately',
    'Protect customer privacy - never share personal information',
    'If unsure, say "Let me check with our team" rather than guessing'
  ],
  ARRAY[
    'Jangan janji refund tanpa semak polisi syarikat',
    'Eskalasi isu bil kepada staf dengan segera',
    'Lindungi privasi pelanggan - jangan kongsi maklumat peribadi',
    'Jika tidak pasti, beritahu "Saya akan semak dengan team" daripada membuat andaian'
  ],
  ARRAY[
    '未经检查公司政策，切勿承诺退款',
    '立即将账单争议上报给人工客服',
    '保护客户隐私 - 切勿分享个人信息',
    '如果不确定，请说"让我与团队确认"而不是猜测'
  ],
  ARRAY[
    'Acknowledge customer concern with empathy',
    'Provide clear step-by-step solutions',
    'Use simple, easy-to-understand language',
    'Keep responses under 3 paragraphs'
  ],
  ARRAY[
    'Akui masalah pelanggan dengan empati',
    'Beri penyelesaian langkah demi langkah yang jelas',
    'Guna bahasa yang mudah difahami',
    'Pastikan respons tidak lebih dari 3 perenggan'
  ],
  ARRAY[
    '以同理心承认客户的担忧',
    '提供清晰的分步解决方案',
    '使用简单易懂的语言',
    '回复保持在3段以内'
  ],
  ARRAY[
    'Hi! How can I help you today?',
    'Welcome! What brings you here?',
    'Hello! What can I assist you with?'
  ],
  ARRAY[
    'Selamat datang! Apa yang boleh saya bantu?',
    'Hi! Ada apa yang saya boleh tolong?',
    'Assalamualaikum! Macam mana saya boleh bantu hari ni?'
  ],
  ARRAY[
    '您好！今天我能帮您什么？',
    '欢迎！有什么可以帮您的？',
    '你好！需要什么帮助吗？'
  ],
  '{"formality": "friendly", "politeness": "high", "empathy": "very_high", "language_mixing": true}'::jsonb,
  ARRAY['en', 'ms', 'zh'],
  'en',
  '[
    {"type": "faq", "name_en": "Frequently Asked Questions", "name_ms": "Soalan Lazim", "name_zh": "常见问题"},
    {"type": "policy", "name_en": "Return & Refund Policy", "name_ms": "Polisi Return & Refund", "name_zh": "退货退款政策"},
    {"type": "troubleshooting", "name_en": "Common Issues Solutions", "name_ms": "Penyelesaian Masalah Lazim", "name_zh": "常见问题解决方案"}
  ]'::jsonb,
  1
) ON CONFLICT DO NOTHING;

-- Template 2: E-commerce (abbreviated - insert full templates from previous version)
INSERT INTO chatbot_templates (industry, template_name, template_name_en, template_name_ms, template_name_zh, display_order)
VALUES ('ecommerce', 'Online Shop Assistant', 'Online Shop Assistant', 'Pembantu Kedai Online', '在线商店助手', 2) ON CONFLICT DO NOTHING;

-- Template 3: Real Estate
INSERT INTO chatbot_templates (industry, template_name, template_name_en, template_name_ms, template_name_zh, display_order)
VALUES ('real_estate', 'Property Inquiry Assistant', 'Property Inquiry Assistant', 'Pembantu Pertanyaan Hartanah', '房产咨询助手', 3) ON CONFLICT DO NOTHING;

-- Template 4: Appointment
INSERT INTO chatbot_templates (industry, template_name, template_name_en, template_name_ms, template_name_zh, display_order)
VALUES ('appointment', 'Appointment Scheduler', 'Appointment Scheduler', 'Penjadual Janji Temu', '预约调度助手', 4) ON CONFLICT DO NOTHING;

-- ============================================================================
-- 12. UPDATE SUBSCRIPTION TIERS WITH MALAYSIA PRICING
-- ============================================================================

-- Update starter tier (RM99 - 1 chatbot)
UPDATE subscription_tiers SET
  display_name = 'Starter',
  description = 'Perfect for small businesses with 1 chatbot',
  price_monthly = 99.00,
  price_yearly = 990.00,
  max_avatars = 1,
  features = '{
    "chatbots": 1,
    "messages_per_month": 1000,
    "products_limit": 100,
    "knowledge_files": 10,
    "fine_tuning": false,
    "priority_support": false,
    "currency": "MYR"
  }'::jsonb
WHERE name = 'starter';

-- Update pro tier to "business" (RM199 - 3 chatbots)
UPDATE subscription_tiers SET
  display_name = 'Business',
  description = 'For growing businesses with up to 3 chatbots',
  price_monthly = 199.00,
  price_yearly = 1990.00,
  max_avatars = 3,
  priority_support = true,
  features = '{
    "chatbots": 3,
    "messages_per_month": 5000,
    "products_limit": 1000,
    "knowledge_files": 50,
    "fine_tuning": true,
    "priority_support": true,
    "currency": "MYR"
  }'::jsonb
WHERE name = 'pro';

-- Update enterprise tier (RM599 - unlimited)
UPDATE subscription_tiers SET
  display_name = 'Enterprise',
  description = 'Custom solution for large organizations with unlimited chatbots',
  price_monthly = 599.00,
  price_yearly = 5990.00,
  max_avatars = -1,
  priority_support = true,
  custom_branding = true,
  features = '{
    "chatbots": -1,
    "messages_per_month": 50000,
    "products_limit": -1,
    "knowledge_files": -1,
    "fine_tuning": true,
    "priority_support": true,
    "custom_branding": true,
    "api_access": true,
    "dedicated_support": true,
    "currency": "MYR"
  }'::jsonb
WHERE name = 'enterprise';

-- ============================================================================
-- 13. GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT ON chatbot_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON chatbot_products TO authenticated;
GRANT SELECT, INSERT, UPDATE ON chatbot_product_uploads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON chatbot_promotions TO authenticated;
GRANT SELECT ON chatbot_analytics TO authenticated;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'BUSINESS CHATBOT TRANSFORMATION COMPLETE!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'New tables created:';
  RAISE NOTICE '  ✓ chatbot_templates (4 industry templates)';
  RAISE NOTICE '  ✓ chatbot_products (product catalog)';
  RAISE NOTICE '  ✓ chatbot_product_uploads (Excel imports)';
  RAISE NOTICE '  ✓ chatbot_promotions (campaigns)';
  RAISE NOTICE '  ✓ chatbot_analytics (metrics)';
  RAISE NOTICE '';
  RAISE NOTICE 'Columns added to avatars table:';
  RAISE NOTICE '  ✓ chatbot_type, industry, company_name';
  RAISE NOTICE '  ✓ business_context, compliance_rules';
  RAISE NOTICE '  ✓ response_guidelines, brand_settings';
  RAISE NOTICE '  ✓ supported_languages (en, ms, zh)';
  RAISE NOTICE '';
  RAISE NOTICE 'Industry templates seeded:';
  RAISE NOTICE '  ✓ Customer Service (Khidmat Pelanggan | 客户服务)';
  RAISE NOTICE '  ✓ E-commerce (Kedai Online | 在线商店)';
  RAISE NOTICE '  ✓ Real Estate (Hartanah | 房地产)';
  RAISE NOTICE '  ✓ Appointment (Janji Temu | 预约)';
  RAISE NOTICE '';
  RAISE NOTICE 'Pricing tiers updated (MYR):';
  RAISE NOTICE '  ✓ Starter: RM99/month (1 chatbot)';
  RAISE NOTICE '  ✓ Business: RM199/month (3 chatbots)';
  RAISE NOTICE '  ✓ Enterprise: RM599/month (unlimited)';
  RAISE NOTICE '';
  RAISE NOTICE 'Ready to build ChatBiz! 🚀';
  RAISE NOTICE '========================================';
END $$;
