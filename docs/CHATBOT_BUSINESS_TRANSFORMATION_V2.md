# Business Chatbot Platform - Malaysia Market Transformation

**Document Version:** 2.0 (REVISED)
**Date:** December 25, 2025
**Status:** READY FOR IMPLEMENTATION
**Target Market:** Malaysia

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Platform Rebranding](#platform-rebranding)
3. [Product Vision](#product-vision)
4. [Database Architecture](#database-architecture)
5. [Core Features](#core-features)
6. [Chatbot Creation Workflow](#chatbot-creation-workflow)
7. [Industry Templates](#industry-templates)
8. [Product Gallery & Excel Upload](#product-gallery--excel-upload)
9. [Pricing Model](#pricing-model)
10. [Implementation Plan](#implementation-plan)
11. [Technical Specifications](#technical-specifications)

---

## Executive Summary

### Transformation Overview

**FROM:** Avatar companion platform with personal features
**TO:** Business chatbot platform for Malaysian SMEs and enterprises

### Key Changes

❌ **REMOVE:**
- Personal avatar features (backstory, personality traits, MBTI, age, gender)
- Memory gallery with personal photos
- Avatar companion terminology
- Complex personality configuration

✅ **ADD:**
- Product/promotion image gallery
- Excel product upload (1000+ SKU support)
- Malaysia-focused templates and tone
- Simplified chatbot creation (3-step process)
- Business-focused pricing (RM99, RM199, RM599)

✅ **KEEP:**
- RAG knowledge base (critical for business FAQs)
- Fine-tuning capability (business conversation training)
- Version control (iterate on prompts)
- API integration (WhatsApp, website widget, REST API)
- Multi-user support

### Platform Name Change

**Current:** AvatarHub / AvatarLab
**Recommended New Name:** **ChatBiz** or **BotSpace**

**Why ChatBiz:**
- Simple, clear, professional
- Malaysia-friendly (works in English & Malay)
- Domain available: chatbiz.my, chatbiz.com
- Easy to remember and spell

**Alternative:** BotSpace (modern, scalable branding)

---

## Platform Rebranding

### Terminology Changes

| Old (Avatar)              | New (Business Chatbot)           |
|---------------------------|----------------------------------|
| Avatar                    | Chatbot / Bot                    |
| Create Avatar             | Create Chatbot                   |
| Avatar Name               | Chatbot Name                     |
| My Avatars                | My Chatbots                      |
| Avatar Studio             | Chatbot Studio                   |
| Backstory                 | Business Context                 |
| Personality Traits        | (REMOVED)                        |
| Hidden Rules              | Compliance Rules                 |
| Behavior Rules            | Response Guidelines              |
| Memory Gallery            | Product Gallery                  |
| Avatar Images             | Chatbot Avatar / Logo            |
| MBTI, Age, Gender         | (REMOVED)                        |

### UI Text Changes

**Homepage:**
- "Create Your AI Avatar" → "Build Your Business Chatbot"
- "Avatar Gallery" → "Chatbot Dashboard"
- "Train Your Avatar" → "Train Your Chatbot"

**Navigation:**
- "My Avatars" → "My Chatbots"
- "Chatbot Studio" remains
- "Create Avatar" → "Create Chatbot"

---

## Product Vision

### Target Audience

**Primary:** Malaysian SMEs (Small & Medium Enterprises)
- E-commerce sellers (Shopee, Lazada, own website)
- Service businesses (clinics, law firms, real estate agencies)
- Retail shops (fashion, electronics, F&B)
- Appointment-based businesses (salons, consultants)

**Secondary:** Malaysian enterprises
- Customer service departments
- Sales teams
- Marketing departments

### Value Proposition

**For Malaysian Businesses:**
"Setup your business chatbot in 5 minutes. Handle customer inquiries 24/7 in English & Bahasa Malaysia. Connect to WhatsApp, your website, or any platform."

**Key Benefits:**
1. **Fast Setup:** 3-step wizard, done in 5 minutes
2. **Malaysia-Focused:** Templates understand Malaysian business culture
3. **Multi-Language:** English, Bahasa Malaysia, Mandarin support
4. **E-commerce Ready:** Upload 1000+ products via Excel
5. **Affordable:** From RM99/month for 1 chatbot
6. **WhatsApp Integration:** Reach customers on their favorite platform

---

## Database Architecture

### Validated Feasibility ✅

After reviewing the existing database schema, **ALL proposed features are achievable** with minimal migration:

#### Existing Tables (Reuse)

**`avatars` table** → Rename fields, add new columns
```sql
-- KEEP these columns (rename in application layer):
- id, user_id, name
- avatar_images → chatbot_images (logo, brand image)
- primary_language, secondary_languages
- knowledge_files (JSONB)
- created_at, updated_at

-- REMOVE these columns (set to NULL, ignore in app):
- age, gender, origin_country
- backstory → business_context
- personality_traits → (ignore)
- hidden_rules → compliance_rules

-- ADD new columns:
- chatbot_type VARCHAR DEFAULT 'business'
- industry VARCHAR (customer_service, ecommerce, real_estate, appointment)
- company_name VARCHAR
- business_context TEXT
- compliance_rules TEXT[]
- response_guidelines TEXT[]
- brand_settings JSONB
```

**`avatar_training_data` table** → Keep as-is ✅
- Already supports training with instructions and files
- Fine-tuning integration ready

**`avatar_prompt_versions` table** → Keep, add fields ✅
```sql
-- ADD:
- compliance_rules TEXT[]
- response_guidelines TEXT[]
```

**`avatar_knowledge_files` table** → Keep as-is ✅
- Perfect for business document upload (FAQs, policies, product info)

**`avatar_fine_tune_jobs` table** → Keep as-is ✅
- OpenAI fine-tuning ready
- Supports gpt-4o-mini and newer models

#### New Tables Required

**`chatbot_templates` table** - Industry templates
```sql
CREATE TABLE chatbot_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  industry VARCHAR NOT NULL,
  template_name VARCHAR NOT NULL,
  description TEXT,

  -- Template content
  business_context_template TEXT,
  compliance_rules TEXT[] DEFAULT '{}',
  response_guidelines TEXT[] DEFAULT '{}',

  -- Malaysia-specific
  default_language VARCHAR DEFAULT 'en-my',
  supported_languages TEXT[] DEFAULT '{en, ms, zh}',
  tone_settings JSONB,

  -- Guidance
  required_documents JSONB DEFAULT '[]',
  setup_instructions TEXT,

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**`chatbot_products` table** - Product gallery for e-commerce ⭐ NEW
```sql
CREATE TABLE chatbot_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chatbot_id UUID REFERENCES avatars(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Product details
  sku VARCHAR,
  product_name VARCHAR NOT NULL,
  description TEXT,
  price DECIMAL(10, 2),
  currency VARCHAR DEFAULT 'MYR',

  -- Product images
  images TEXT[] DEFAULT '{}',
  primary_image_url TEXT,

  -- Categories & tags
  category VARCHAR,
  tags TEXT[] DEFAULT '{}',

  -- Stock
  stock_quantity INTEGER,
  in_stock BOOLEAN DEFAULT true,

  -- Links
  product_url TEXT,

  -- Metadata
  additional_info JSONB DEFAULT '{}',

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(chatbot_id, sku)
);

CREATE INDEX idx_chatbot_products_chatbot_id ON chatbot_products(chatbot_id);
CREATE INDEX idx_chatbot_products_sku ON chatbot_products(sku);
CREATE INDEX idx_chatbot_products_category ON chatbot_products(category);
```

**`chatbot_product_uploads` table** - Track Excel uploads
```sql
CREATE TABLE chatbot_product_uploads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chatbot_id UUID REFERENCES avatars(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  file_name VARCHAR NOT NULL,
  file_path VARCHAR NOT NULL,
  file_size BIGINT,

  total_rows INTEGER,
  processed_rows INTEGER DEFAULT 0,
  successful_rows INTEGER DEFAULT 0,
  failed_rows INTEGER DEFAULT 0,

  status VARCHAR DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_log JSONB DEFAULT '[]',

  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);
```

**`chatbot_promotions` table** - Promotional images/campaigns
```sql
CREATE TABLE chatbot_promotions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chatbot_id UUID REFERENCES avatars(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  title VARCHAR NOT NULL,
  description TEXT,
  promo_code VARCHAR,

  -- Images
  banner_image_url TEXT,
  thumbnail_url TEXT,

  -- Validity
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT true,

  -- Terms
  terms_and_conditions TEXT,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**`chatbot_analytics` table** - Usage metrics (future)
```sql
CREATE TABLE chatbot_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chatbot_id UUID REFERENCES avatars(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),

  date DATE NOT NULL,
  total_conversations INT DEFAULT 0,
  total_messages INT DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(chatbot_id, date)
);
```

### Database Migration Strategy

**Approach:** Non-breaking migration (backward compatible)

1. **Add new columns** to `avatars` table
2. **Create new tables** (chatbot_templates, chatbot_products, etc.)
3. **Keep old columns** (don't drop - just ignore in new UI)
4. **Application-layer mapping** (old field names → new meanings)

**Benefits:**
- No data loss
- Can rollback if needed
- Existing API still works
- Gradual migration possible

---

## Core Features

### 1. RAG Knowledge Base ✅ (Keep)

**What it does:**
- Businesses upload documents (PDFs, Word, text)
- AI converts to vector embeddings
- Chatbot retrieves relevant info when answering

**Malaysia business use cases:**
- Upload product catalog PDF
- Upload FAQ document
- Upload return/exchange policy
- Upload halal certification info
- Upload warranty terms

**Technical:**
- Uses existing `avatar_knowledge_files` table
- Vector search via Supabase pgvector
- Already implemented and working

### 2. Fine-Tuning Training ✅ (Keep)

**What it does:**
- Users upload conversation examples
- Train custom OpenAI model with business-specific language
- Chatbot learns company's tone and terminology

**Malaysia business use cases:**
- Train on Bahasa Malaysia conversations
- Learn product-specific terminology
- Match brand voice (formal vs. casual)
- Learn common Manglish phrases

**Technical:**
- Uses existing `avatar_fine_tune_jobs` table
- OpenAI Fine-Tuning API integration
- Supports latest models (gpt-4o-mini, gpt-4o)

### 3. Product Gallery ⭐ NEW

**What it does:**
- Upload product images (promotions, products, services)
- Chatbot can reference products visually
- Share product images in WhatsApp conversations

**Malaysia business use cases:**
- E-commerce: Upload product photos
- F&B: Upload menu items with photos
- Real estate: Upload property photos
- Services: Upload service package images

**Technical:**
- New `chatbot_products` table
- Image upload to Supabase Storage
- Excel bulk upload support (see below)

### 4. Excel Product Upload ⭐ NEW

**What it does:**
- Upload Excel file with 1000+ products
- Auto-import: SKU, name, price, description, image URLs
- Bulk update existing products

**Excel template format:**
```
| SKU      | Product Name     | Description          | Price | Category | Image URL            | Stock |
|----------|------------------|----------------------|-------|----------|----------------------|-------|
| PROD001  | Baju Kurung Blue | Premium cotton...    | 89.90 | Fashion  | https://...img1.jpg  | 50    |
| PROD002  | Sambal Paste     | Homemade spicy...    | 15.00 | Food     | https://...img2.jpg  | 200   |
```

**Technical:**
- Parse Excel using SheetJS (xlsx library)
- Bulk insert to `chatbot_products` table
- Validation: check required fields, duplicate SKUs
- Progress tracking in `chatbot_product_uploads` table

### 5. Simplified Prompt Management

**What it does:**
- Simple text editor for business context
- Checkbox list for compliance rules
- Tag-based response guidelines

**NOT like before:**
- ❌ No complex personality sliders
- ❌ No MBTI selection
- ❌ No backstory template library

**Instead:**
- ✅ "Describe your business in 2-3 sentences"
- ✅ Select compliance rules from checklist
- ✅ Add simple response guidelines

### 6. Malaysia-Focused Templates

**What it does:**
- Pre-configured chatbot templates for Malaysian businesses
- Tone adapted to Malaysian communication style
- Multi-language support (English, BM, Mandarin)

**Templates:**
1. Customer Service
2. E-commerce / Online Store
3. Real Estate / Property
4. Appointment Booking (clinic, salon, consultant)

---

## Chatbot Creation Workflow

### ❌ OLD WORKFLOW (Too Complex)

```
Step 1: Choose avatar type
Step 2: Fill basic info (name, age, gender, origin country)
Step 3: Write backstory
Step 4: Select personality traits (10+ options)
Step 5: Choose MBTI type
Step 6: Write hidden rules
Step 7: Upload avatar images
Step 8: Upload knowledge files
Step 9: Add memories (optional)
Step 10: Test and deploy
```

### ✅ NEW WORKFLOW (Simplified)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 3-STEP CHATBOT CREATION (5 MINUTES)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 1: Choose Industry Template (1 min)
┌─────────────────────────────────────┐
│ 💬 Customer Service                 │
│ 🛒 E-commerce / Online Shop         │
│ 🏢 Real Estate / Property           │
│ 📅 Appointment Booking              │
└─────────────────────────────────────┘

STEP 2: Basic Information (2 min)
┌─────────────────────────────────────┐
│ Chatbot Name: _________________     │
│ Company Name: _________________     │
│ Industry: [Auto-filled]             │
│                                     │
│ Business Description (2-3 sentences)│
│ ________________________________    │
│ ________________________________    │
│                                     │
│ Primary Language:                   │
│ ● English  ○ Bahasa Malaysia        │
│                                     │
│ Support Languages:                  │
│ ☑ English  ☑ Bahasa  ☐ Mandarin    │
└─────────────────────────────────────┘

STEP 3: Upload Knowledge & Products (2 min)
┌─────────────────────────────────────┐
│ Knowledge Base (Optional)           │
│ [Upload PDF] FAQ, Policies, etc.    │
│                                     │
│ Products (Optional)                 │
│ [Upload Excel] Product list         │
│ OR                                  │
│ [Add Manually] One by one           │
│                                     │
│ [Skip for Now] Can add later        │
└─────────────────────────────────────┘

✅ DONE! Test Your Chatbot
```

### Detailed Flow

#### STEP 1: Choose Industry Template

**UI Design:**
```
┌───────────────────────────────────────────────────────┐
│  Pilih Industri Bisnes Anda / Choose Your Industry    │
│                                                        │
│  ┌──────────────────────┐  ┌──────────────────────┐  │
│  │ 💬                   │  │ 🛒                   │  │
│  │ Customer Service     │  │ E-commerce Shop      │  │
│  │                      │  │                      │  │
│  │ For: Support, FAQ    │  │ For: Product sales,  │  │
│  │      Troubleshooting │  │      Recommendations │  │
│  │                      │  │                      │  │
│  │ [Pilih Template]     │  │ [Pilih Template]     │  │
│  └──────────────────────┘  └──────────────────────┘  │
│                                                        │
│  ┌──────────────────────┐  ┌──────────────────────┐  │
│  │ 🏢                   │  │ 📅                   │  │
│  │ Real Estate          │  │ Appointment Booking  │  │
│  │                      │  │                      │  │
│  │ For: Property inquiry│  │ For: Clinic, salon,  │  │
│  │      Showings        │  │      Consultation    │  │
│  │                      │  │                      │  │
│  │ [Pilih Template]     │  │ [Pilih Template]     │  │
│  └──────────────────────┘  └──────────────────────┘  │
└───────────────────────────────────────────────────────┘
```

**What happens:**
- User clicks template
- Pre-fills business context, compliance rules, response guidelines
- User can customize after selection

#### STEP 2: Basic Information

**UI Design:**
```
┌───────────────────────────────────────────────────────┐
│  Maklumat Asas / Basic Information                     │
│                                                        │
│  Nama Chatbot / Chatbot Name                          │
│  ┌─────────────────────────────────────────────────┐  │
│  │ Contoh: Customer Support Bot, Shop Assistant    │  │
│  └─────────────────────────────────────────────────┘  │
│                                                        │
│  Nama Syarikat / Company Name                         │
│  ┌─────────────────────────────────────────────────┐  │
│  │ Contoh: Kedai Ramli, ABC Electronics            │  │
│  └─────────────────────────────────────────────────┘  │
│                                                        │
│  Penerangan Bisnes / Business Description             │
│  (Terangkan bisnes anda dalam 2-3 ayat)              │
│  ┌─────────────────────────────────────────────────┐  │
│  │ Contoh: Kami menjual elektronik dan aksesori   │  │
│  │ telefon di seluruh Malaysia. Kami menawarkan   │  │
│  │ penghantaran percuma untuk pesanan RM100+.      │  │
│  └─────────────────────────────────────────────────┘  │
│                                                        │
│  Bahasa Utama / Primary Language                      │
│  ┌─────────┬─────────┬─────────┐                     │
│  │ ● English│ ○ Bahasa│ ○ 中文   │                     │
│  └─────────┴─────────┴─────────┘                     │
│                                                        │
│  Bahasa Sokongan / Support Multiple Languages         │
│  ☑ English   ☑ Bahasa Malaysia   ☐ Mandarin          │
│                                                        │
│  Tone / Nada Perbualan                                │
│  ○ Formal (Bank, Guaman)                              │
│  ● Mesra / Friendly (Kebanyakan bisnes)               │
│  ○ Kasual (Startup, F&B)                              │
│                                                        │
│  [← Kembali]                          [Seterusnya →]  │
└───────────────────────────────────────────────────────┘
```

**Auto-filled from template:**
- Compliance rules (can edit)
- Response guidelines (can edit)
- Tone settings

**User provides:**
- Chatbot name
- Company name
- Business description (2-3 sentences)
- Language preferences

#### STEP 3: Upload Knowledge & Products

**UI Design:**
```
┌───────────────────────────────────────────────────────┐
│  Upload Pengetahuan & Produk / Knowledge & Products    │
│                                                        │
│  📚 Knowledge Base (Pilihan / Optional)                │
│  ────────────────────────────────────────────────────  │
│  Upload dokumen untuk chatbot jawab soalan            │
│                                                        │
│  Disyorkan / Recommended:                             │
│  • Soalan Lazim (FAQ)                                 │
│  • Polisi Return & Refund                             │
│  • Maklumat Produk                                    │
│                                                        │
│  ┌─────────────────────────────────────────────────┐  │
│  │ [📄 Upload PDF/Word]  [📝 Tulis Text]           │  │
│  │                                                  │  │
│  │ Files uploaded: 0                                │  │
│  └─────────────────────────────────────────────────┘  │
│                                                        │
│  🛍️ Produk / Products (Pilihan / Optional)            │
│  ────────────────────────────────────────────────────  │
│  Untuk e-commerce: Upload senarai produk             │
│                                                        │
│  ┌─────────────────────────────────────────────────┐  │
│  │ [📊 Upload Excel]  Download template            │  │
│  │                                                  │  │
│  │ Excel format: SKU, Name, Price, Description,    │  │
│  │               Image URL, Stock                   │  │
│  │                                                  │  │
│  │ OR                                               │  │
│  │                                                  │  │
│  │ [➕ Add Product Manually]                        │  │
│  └─────────────────────────────────────────────────┘  │
│                                                        │
│  Products uploaded: 0                                  │
│                                                        │
│  💡 Tip: Boleh tambah kemudian di Chatbot Studio     │
│                                                        │
│  [← Kembali]  [Skip Sekarang]  [Siap & Test Chatbot] │
└───────────────────────────────────────────────────────┘
```

**Excel Upload Process:**
1. User clicks "Upload Excel"
2. File validation (check columns: SKU, Name, Price)
3. Preview first 5 rows
4. User confirms
5. Background processing (shows progress bar)
6. Results: "100 products imported successfully, 5 failed (duplicate SKU)"

#### After Creation: Test Chat

```
┌───────────────────────────────────────────────────────┐
│  🎉 Chatbot Anda Siap! / Your Chatbot is Ready!       │
│                                                        │
│  ✅ Customer Support Bot has been created              │
│                                                        │
│  Test Chatbot Anda                                    │
│  ┌─────────────────────────────────────────────────┐  │
│  │  Bot: Selamat datang! Apa yang boleh saya      │  │
│  │       bantu hari ini?                            │  │
│  │                                                  │  │
│  │  You: Apa polisi return anda?                   │  │
│  │                                                  │  │
│  │  Bot: Polisi return kami membenarkan return    │  │
│  │       dalam 7 hari dari tarikh pembelian...     │  │
│  │                                                  │  │
│  │  ──────────────────────────────────────────────  │  │
│  │  Type: _____________________  [Hantar]          │  │
│  └─────────────────────────────────────────────────┘  │
│                                                        │
│  [🎨 Customize More]      [🚀 Deploy to WhatsApp]     │
└───────────────────────────────────────────────────────┘
```

---

## Industry Templates

### Template 1: Customer Service (Khidmat Pelanggan)

**Industry:** `customer_service`
**Target:** SMEs with customer support needs

**Template Configuration:**
```javascript
{
  industry: "customer_service",
  template_name: "Customer Support Assistant",
  description: "Handle FAQ, troubleshooting, and customer inquiries",

  business_context_template: `You are a helpful customer support assistant for [COMPANY_NAME]. Your role is to answer customer questions quickly and professionally. Always be polite and patient.

Anda adalah pembantu khidmat pelanggan untuk [COMPANY_NAME]. Tugas anda adalah menjawab soalan pelanggan dengan cepat dan profesional.`,

  compliance_rules: [
    "Never promise refunds without checking company policy / Jangan janji refund tanpa semak polisi",
    "Escalate billing issues to human staff / Eskalasi isu billing kepada staf",
    "Protect customer privacy / Lindungi privasi pelanggan",
    "If unsure, say 'Let me check with our team' / Jika tidak pasti, beritahu 'Saya check dengan team dulu'"
  ],

  response_guidelines: [
    "Acknowledge customer concern / Akui masalah pelanggan",
    "Provide clear step-by-step solutions / Beri penyelesaian step-by-step",
    "Use simple language / Guna bahasa mudah",
    "End with 'Ada lagi yang boleh saya bantu?' / 'Anything else I can help with?'",
    "Keep responses short (under 3 paragraphs)"
  ],

  tone_settings: {
    formality: "friendly",
    politeness: "high",
    language_mixing: true // Allow Manglish
  },

  default_language: "en-my",
  supported_languages: ["en", "ms"],

  required_documents: [
    { type: "faq", description: "Frequently Asked Questions / Soalan Lazim" },
    { type: "policy", description: "Return/Refund Policy / Polisi Return" },
    { type: "troubleshooting", description: "Common Issues Solutions / Penyelesaian Masalah" }
  ],

  sample_greetings: [
    "Hi! How can I help you today?",
    "Selamat datang! Apa yang boleh saya bantu?",
    "Hello! Ada apa yang saya boleh tolong?"
  ]
}
```

### Template 2: E-commerce / Online Shop

**Industry:** `ecommerce`
**Target:** Shopee/Lazada sellers, online shops

**Template Configuration:**
```javascript
{
  industry: "ecommerce",
  template_name: "Online Shop Assistant",
  description: "Product recommendations, order inquiries, and sales",

  business_context_template: `You are a friendly sales assistant for [COMPANY_NAME], an online shop in Malaysia. Help customers find products, answer questions about pricing and shipping, and provide excellent service.

Anda adalah pembantu jualan untuk [COMPANY_NAME]. Bantu pelanggan cari produk yang sesuai dan jawab soalan tentang harga dan penghantaran.`,

  compliance_rules: [
    "Always mention shipping costs clearly / Nyatakan kos penghantaran dengan jelas",
    "State delivery time for Peninsular Malaysia and East Malaysia / Nyatakan masa penghantaran Semenanjung dan Sabah Sarawak",
    "Never make false claims about products / Jangan buat dakwaan palsu tentang produk",
    "Mention if product is out of stock / Beritahu jika produk out of stock",
    "Provide return policy when discussing purchases / Beri info polisi return bila bincang pembelian"
  ],

  response_guidelines: [
    "Ask about customer needs before recommending / Tanya keperluan pelanggan dulu",
    "Recommend 2-3 products maximum / Cadang maksimum 2-3 produk je",
    "Highlight key benefits and features / Highlight kelebihan utama produk",
    "Include product price in MYR / Sertakan harga dalam RM",
    "Suggest related products (upselling) / Cadang produk berkaitan",
    "Use emojis to be friendly 😊"
  ],

  tone_settings: {
    formality: "casual",
    politeness: "medium",
    enthusiasm: "high",
    language_mixing: true
  },

  default_language: "en-my",
  supported_languages: ["en", "ms", "zh"],

  required_documents: [
    { type: "product_catalog", description: "Product List / Senarai Produk" },
    { type: "shipping_policy", description: "Shipping & Delivery Info / Info Penghantaran" },
    { type: "faq", description: "Product FAQ / Soalan Produk" }
  ],

  sample_greetings: [
    "Hi! Nak cari apa hari ni? 😊",
    "Welcome! What are you looking for today?",
    "Selamat datang! Ada yang saya boleh tolong?"
  ],

  product_features: {
    enable_product_search: true,
    enable_excel_upload: true,
    enable_price_comparison: true,
    enable_stock_check: true
  }
}
```

### Template 3: Real Estate / Property

**Industry:** `real_estate`
**Target:** Property agents, real estate agencies

**Template Configuration:**
```javascript
{
  industry: "real_estate",
  template_name: "Property Inquiry Assistant",
  description: "Property inquiries, viewing schedules, and lead qualification",

  business_context_template: `You are a professional property assistant for [COMPANY_NAME], a real estate agency in Malaysia. Help potential buyers/renters with property inquiries, schedule viewings, and provide area information.

Anda adalah pembantu hartanah untuk [COMPANY_NAME]. Bantu bakal pembeli/penyewa dengan pertanyaan tentang hartanah dan aturkan viewing.`,

  compliance_rules: [
    "Never promise property appreciation / Jangan janji harga naik",
    "State property price clearly in MYR / Nyatakan harga dalam RM dengan jelas",
    "Mention property location (state, area) / Sebut lokasi hartanah",
    "Disclose if property is sold / Beritahu jika hartanah dah terjual",
    "Collect contact info for viewing appointments / Collect info untuk viewing",
    "Follow Malaysia property advertising regulations / Ikut peraturan iklan hartanah Malaysia"
  ],

  response_guidelines: [
    "Ask budget range and preferred location / Tanya budget dan lokasi pilihan",
    "Highlight property features (bedrooms, sqft, amenities) / Highlight ciri hartanah",
    "Provide nearby amenities (schools, LRT, shopping) / Bagi info kemudahan berdekatan",
    "Recommend 2-3 similar properties / Cadang 2-3 hartanah serupa",
    "Offer to schedule viewing / Tawarkan schedule viewing",
    "Collect: name, phone, preferred viewing date"
  ],

  tone_settings: {
    formality: "professional",
    politeness: "high",
    language_mixing: false
  },

  default_language: "en",
  supported_languages: ["en", "ms", "zh"],

  required_documents: [
    { type: "property_listings", description: "Available Properties / Hartanah Tersedia" },
    { type: "area_guide", description: "Neighborhood Info / Maklumat Kawasan" },
    { type: "faq", description: "Common Questions / Soalan Lazim" }
  ],

  sample_greetings: [
    "Hello! Looking to buy or rent a property?",
    "Hi! Nak beli atau sewa rumah?",
    "Welcome! How can I help with your property search?"
  ],

  product_features: {
    enable_product_search: true, // for properties
    enable_excel_upload: true, // property listings
    enable_image_gallery: true,
    enable_location_filter: true
  }
}
```

### Template 4: Appointment Booking (Tempahan Janji Temu)

**Industry:** `appointment`
**Target:** Clinics, salons, consultants, lawyers

**Template Configuration:**
```javascript
{
  industry: "appointment",
  template_name: "Appointment Scheduler",
  description: "Book appointments, check availability, send reminders",

  business_context_template: `You are a professional appointment scheduler for [COMPANY_NAME]. Help customers book appointments, check availability, and answer questions about services.

Anda adalah pembantu tempahan untuk [COMPANY_NAME]. Bantu pelanggan tempah janji temu dan jawab soalan tentang perkhidmatan.`,

  compliance_rules: [
    "Confirm appointment details clearly (date, time, service) / Sahkan butiran tempahan dengan jelas",
    "Ask for customer contact info (name, phone) / Minta maklumat pelanggan",
    "State operating hours / Nyatakan waktu operasi",
    "Mention cancellation policy / Beritahu polisi pembatalan",
    "For medical: Never provide medical advice / Untuk klinik: Jangan beri nasihat perubatan",
    "For legal: State this is not legal advice / Untuk guaman: Nyatakan bukan nasihat undang-undang"
  ],

  response_guidelines: [
    "Greet warmly and professionally / Salam dengan mesra",
    "Ask preferred date and time / Tanya tarikh dan masa pilihan",
    "Check availability (integrate with calendar) / Check ketersediaan",
    "Confirm booking details before finalizing / Sahkan butiran sebelum confirm",
    "Provide pre-appointment instructions if any / Beri arahan pra-janji temu jika ada",
    "Send confirmation message with details / Hantar mesej pengesahan"
  ],

  tone_settings: {
    formality: "professional",
    politeness: "very_high",
    empathy: "high",
    language_mixing: false
  },

  default_language: "en-my",
  supported_languages: ["en", "ms"],

  required_documents: [
    { type: "services", description: "Services Offered / Perkhidmatan Ditawarkan" },
    { type: "pricing", description: "Service Pricing / Harga Perkhidmatan" },
    { type: "operating_hours", description: "Business Hours / Waktu Operasi" },
    { type: "faq", description: "Common Questions / Soalan Lazim" }
  ],

  sample_greetings: [
    "Hello! Would you like to book an appointment?",
    "Selamat sejahtera. Nak tempah janji temu?",
    "Hi there! How may I assist you with your appointment?"
  ],

  integration_features: {
    calendar_integration: true, // Google Calendar, Outlook
    reminder_sms: true,
    confirmation_whatsapp: true
  }
}
```

---

## Product Gallery & Excel Upload

### Product Gallery Feature

**Purpose:** Allow e-commerce chatbots to showcase products with images

**Components:**

1. **Product Management UI**
```
┌───────────────────────────────────────────────────────┐
│  Product Gallery (123 products)          [+ Add New]  │
│                                                        │
│  [Search] ____________  [Filter by Category ▼]        │
│                                                        │
│  ┌──────────┬──────────┬──────────┬──────────┐       │
│  │ [Image]  │ [Image]  │ [Image]  │ [Image]  │       │
│  │ Baju     │ Seluar   │ Tudung   │ Kasut    │       │
│  │ Kurung   │ Jeans    │ Bawal    │ Sneakers │       │
│  │ RM89.90  │ RM120.00 │ RM35.00  │ RM199.00 │       │
│  │ In Stock │ In Stock │ 5 left   │ Sold Out │       │
│  │ [Edit]   │ [Edit]   │ [Edit]   │ [Edit]   │       │
│  └──────────┴──────────┴──────────┴──────────┘       │
│                                                        │
│  [Bulk Actions ▼]  [Upload Excel]  [Export CSV]       │
└───────────────────────────────────────────────────────┘
```

2. **Add Product Form**
```
┌───────────────────────────────────────────────────────┐
│  Add New Product                                       │
│                                                        │
│  Product Name *                                        │
│  ┌─────────────────────────────────────────────────┐  │
│  │ Baju Kurung Moden - Blue Floral                 │  │
│  └─────────────────────────────────────────────────┘  │
│                                                        │
│  SKU *                    Price (MYR) *                │
│  ┌──────────────┐        ┌──────────────┐            │
│  │ PROD001      │        │ 89.90        │            │
│  └──────────────┘        └──────────────┘            │
│                                                        │
│  Description                                           │
│  ┌─────────────────────────────────────────────────┐  │
│  │ Premium cotton blend baju kurung with modern   │  │
│  │ floral pattern. Available in sizes S-XL.        │  │
│  └─────────────────────────────────────────────────┘  │
│                                                        │
│  Category            Stock Quantity                    │
│  ┌──────────────┐   ┌──────────────┐                 │
│  │ Fashion ▼    │   │ 50           │                 │
│  └──────────────┘   └──────────────┘                 │
│                                                        │
│  Product Images                                        │
│  ┌─────────────────────────────────────────────────┐  │
│  │ [Upload Image] or [Enter Image URL]            │  │
│  │                                                  │  │
│  │ [Uploaded: img1.jpg] [Remove]                   │  │
│  │ [+ Add More Images]                             │  │
│  └─────────────────────────────────────────────────┘  │
│                                                        │
│  Tags (comma separated)                                │
│  ┌─────────────────────────────────────────────────┐  │
│  │ baju kurung, fashion, women, modest wear        │  │
│  └─────────────────────────────────────────────────┘  │
│                                                        │
│  [Cancel]                          [Save Product]     │
└───────────────────────────────────────────────────────┘
```

### Excel Upload Feature

**Excel Template Format:**

```excel
| SKU      | Product Name           | Description                  | Price | Category | Image URL                    | Stock | Tags                    |
|----------|------------------------|------------------------------|-------|----------|------------------------------|-------|-------------------------|
| PROD001  | Baju Kurung Blue       | Premium cotton blend...      | 89.90 | Fashion  | https://img.com/prod001.jpg  | 50    | baju kurung, women      |
| PROD002  | Seluar Jeans Men       | Denim jeans with stretch...  | 120.00| Fashion  | https://img.com/prod002.jpg  | 30    | jeans, men              |
| FOOD001  | Sambal Paste Homemade  | Spicy sambal paste 200g...   | 15.00 | Food     | https://img.com/food001.jpg  | 200   | sambal, food, spicy     |
```

**Upload Process:**

```
┌───────────────────────────────────────────────────────┐
│  Upload Products via Excel                             │
│                                                        │
│  Step 1: Download Template                             │
│  ┌─────────────────────────────────────────────────┐  │
│  │ [📥 Download Excel Template]                    │  │
│  └─────────────────────────────────────────────────┘  │
│                                                        │
│  Step 2: Fill in Your Products                         │
│  Fill in the Excel file with your product data         │
│                                                        │
│  Step 3: Upload File                                   │
│  ┌─────────────────────────────────────────────────┐  │
│  │ [📤 Choose Excel File]                          │  │
│  │                                                  │  │
│  │ Selected: products_2025.xlsx (256 KB)           │  │
│  └─────────────────────────────────────────────────┘  │
│                                                        │
│  Preview (First 5 rows)                                │
│  ┌─────────────────────────────────────────────────┐  │
│  │ SKU     | Name          | Price | Stock         │  │
│  │ PROD001 | Baju Kurung   | 89.90 | 50     ✓     │  │
│  │ PROD002 | Seluar Jeans  | 120.00| 30     ✓     │  │
│  │ PROD003 | Tudung Bawal  | 35.00 | 5      ✓     │  │
│  │ PROD004 | Kasut         | 199.00| 0      ⚠️     │  │
│  │ PROD005 | Handbag       | ERROR | -      ❌     │  │
│  │                                                  │  │
│  │ Total rows: 1,234                                │  │
│  │ Valid: 1,230  |  Issues: 4                       │  │
│  └─────────────────────────────────────────────────┘  │
│                                                        │
│  ⚠️ Issues Found:                                     │
│  • Row 5: Price must be a number                      │
│  • Row 245: Missing SKU                               │
│  • Row 789: Duplicate SKU (PROD123)                   │
│  • Row 1001: Missing product name                     │
│                                                        │
│  Import Options:                                       │
│  ○ Skip rows with errors (import 1,230 products)      │
│  ● Fix errors first (recommended)                     │
│                                                        │
│  [Cancel]  [Download Error Report]  [Import Products] │
└───────────────────────────────────────────────────────┘
```

**After Upload:**
```
┌───────────────────────────────────────────────────────┐
│  ✅ Import Successful!                                 │
│                                                        │
│  📊 Import Summary                                     │
│  ┌─────────────────────────────────────────────────┐  │
│  │ Total Rows Processed:    1,234                  │  │
│  │ Successfully Imported:   1,230                  │  │
│  │ Failed (errors):         4                       │  │
│  │                                                  │  │
│  │ Time taken: 12 seconds                           │  │
│  └─────────────────────────────────────────────────┘  │
│                                                        │
│  [View Imported Products]  [Download Error Log]       │
└───────────────────────────────────────────────────────┘
```

### Technical Implementation

**Excel Parsing:**
```typescript
// src/services/excelImportService.ts
import * as XLSX from 'xlsx';

interface ProductRow {
  SKU: string;
  'Product Name': string;
  Description: string;
  Price: number;
  Category: string;
  'Image URL': string;
  Stock: number;
  Tags: string;
}

export async function parseExcelFile(file: File): Promise<ProductRow[]> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  const jsonData: ProductRow[] = XLSX.utils.sheet_to_json(worksheet);
  return jsonData;
}

export async function validateProducts(products: ProductRow[]): Promise<{
  valid: ProductRow[];
  errors: { row: number; error: string }[];
}> {
  const valid: ProductRow[] = [];
  const errors: { row: number; error: string }[] = [];

  products.forEach((product, index) => {
    const row = index + 2; // Excel rows start at 1, header is row 1

    // Validate required fields
    if (!product.SKU) {
      errors.push({ row, error: 'Missing SKU' });
      return;
    }
    if (!product['Product Name']) {
      errors.push({ row, error: 'Missing Product Name' });
      return;
    }
    if (!product.Price || isNaN(product.Price)) {
      errors.push({ row, error: 'Invalid Price' });
      return;
    }

    // Check for duplicate SKU
    if (valid.some(p => p.SKU === product.SKU)) {
      errors.push({ row, error: `Duplicate SKU: ${product.SKU}` });
      return;
    }

    valid.push(product);
  });

  return { valid, errors };
}

export async function bulkImportProducts(
  chatbotId: string,
  userId: string,
  products: ProductRow[]
): Promise<void> {
  const { data, error } = await supabase
    .from('chatbot_products')
    .upsert(
      products.map(p => ({
        chatbot_id: chatbotId,
        user_id: userId,
        sku: p.SKU,
        product_name: p['Product Name'],
        description: p.Description,
        price: p.Price,
        currency: 'MYR',
        category: p.Category,
        images: p['Image URL'] ? [p['Image URL']] : [],
        primary_image_url: p['Image URL'],
        stock_quantity: p.Stock || 0,
        in_stock: (p.Stock || 0) > 0,
        tags: p.Tags ? p.Tags.split(',').map(t => t.trim()) : [],
        is_active: true
      })),
      { onConflict: 'chatbot_id,sku' } // Update if SKU exists
    );

  if (error) throw error;
}
```

---

## Pricing Model

### Malaysia Market Pricing (MYR)

**Target:** Affordable for Malaysian SMEs

```
┌─────────────────────────────────────────────────────┐
│                  PRICING PLANS                       │
└─────────────────────────────────────────────────────┘

┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│   STARTER        │  │   BUSINESS       │  │   ENTERPRISE     │
│                  │  │                  │  │                  │
│   RM99/month     │  │   RM199/month    │  │   RM599/month    │
│                  │  │                  │  │                  │
│ • 1 Chatbot      │  │ • Up to 3 Chatbots│ │ • Unlimited      │
│ • 1,000 messages │  │ • 5,000 messages  │  │ • 50,000 messages│
│ • Knowledge Base │  │ • Knowledge Base  │  │ • Knowledge Base │
│ • 100 products   │  │ • 1,000 products  │  │ • Unlimited      │
│ • WhatsApp       │  │ • WhatsApp        │  │ • WhatsApp       │
│ • Website widget │  │ • Website widget  │  │ • Website widget │
│ • Email support  │  │ • Fine-tuning     │  │ • Fine-tuning    │
│                  │  │ • Priority support│  │ • Custom training│
│                  │  │                  │  │ • Dedicated support│
│                  │  │                  │  │ • Custom branding│
│                  │  │                  │  │ • API access     │
│                  │  │                  │  │                  │
│  [Pilih Plan]    │  │  [Pilih Plan]    │  │  [Contact Sales] │
└──────────────────┘  └──────────────────┘  └──────────────────┘

💡 Free 7-day trial • No credit card required
💳 Payment: Online banking, Credit card, E-wallet (Touch 'n Go, GrabPay)
```

### Pricing Database Schema

**Add to existing subscription system:**
```sql
-- Update subscription tiers
UPDATE subscription_tiers SET
  name = 'Starter',
  price = 99.00,
  currency = 'MYR',
  features = '{
    "chatbots": 1,
    "messages_per_month": 1000,
    "products_limit": 100,
    "knowledge_files": 10,
    "fine_tuning": false,
    "priority_support": false
  }'::jsonb
WHERE tier_level = 1;

UPDATE subscription_tiers SET
  name = 'Business',
  price = 199.00,
  currency = 'MYR',
  features = '{
    "chatbots": 3,
    "messages_per_month": 5000,
    "products_limit": 1000,
    "knowledge_files": 50,
    "fine_tuning": true,
    "priority_support": true
  }'::jsonb
WHERE tier_level = 2;

UPDATE subscription_tiers SET
  name = 'Enterprise',
  price = 599.00,
  currency = 'MYR',
  features = '{
    "chatbots": -1,
    "messages_per_month": 50000,
    "products_limit": -1,
    "knowledge_files": -1,
    "fine_tuning": true,
    "priority_support": true,
    "custom_branding": true,
    "api_access": true
  }'::jsonb
WHERE tier_level = 3;
```

---

## Implementation Plan

### Phase 1: Database & Core Infrastructure (Week 1-2)

**Goal:** Setup database tables, migrate schema, create base services

#### Week 1: Database Migration

**Tasks:**
- [ ] Create migration file: `20251226000000_chatbot_business_transformation.sql`
- [ ] Add new columns to `avatars` table
- [ ] Create `chatbot_templates` table
- [ ] Create `chatbot_products` table
- [ ] Create `chatbot_product_uploads` table
- [ ] Create `chatbot_promotions` table
- [ ] Seed 4 industry templates
- [ ] Test migration on staging database

**Migration Script:**
```sql
-- File: supabase/migrations/20251226000000_chatbot_business_transformation.sql

-- 1. Add business fields to avatars table
ALTER TABLE avatars
ADD COLUMN IF NOT EXISTS chatbot_type VARCHAR DEFAULT 'business',
ADD COLUMN IF NOT EXISTS industry VARCHAR,
ADD COLUMN IF NOT EXISTS company_name VARCHAR,
ADD COLUMN IF NOT EXISTS business_context TEXT,
ADD COLUMN IF NOT EXISTS compliance_rules TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS response_guidelines TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS brand_settings JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS tone_settings JSONB DEFAULT '{}'::jsonb;

-- 2. Add columns to avatar_prompt_versions
ALTER TABLE avatar_prompt_versions
ADD COLUMN IF NOT EXISTS compliance_rules TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS response_guidelines TEXT[] DEFAULT '{}';

-- 3. Create chatbot_templates table
CREATE TABLE chatbot_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  industry VARCHAR NOT NULL,
  template_name VARCHAR NOT NULL,
  description TEXT,
  business_context_template TEXT,
  compliance_rules TEXT[] DEFAULT '{}',
  response_guidelines TEXT[] DEFAULT '{}',
  tone_settings JSONB DEFAULT '{}'::jsonb,
  default_language VARCHAR DEFAULT 'en-my',
  supported_languages TEXT[] DEFAULT '{en,ms}',
  required_documents JSONB DEFAULT '[]'::jsonb,
  sample_greetings TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 4. Create chatbot_products table
CREATE TABLE chatbot_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chatbot_id UUID REFERENCES avatars(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  sku VARCHAR NOT NULL,
  product_name VARCHAR NOT NULL,
  description TEXT,
  price DECIMAL(10, 2),
  currency VARCHAR DEFAULT 'MYR',
  images TEXT[] DEFAULT '{}',
  primary_image_url TEXT,
  category VARCHAR,
  tags TEXT[] DEFAULT '{}',
  stock_quantity INTEGER DEFAULT 0,
  in_stock BOOLEAN DEFAULT true,
  product_url TEXT,
  additional_info JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(chatbot_id, sku)
);

-- 5. Create chatbot_product_uploads table
CREATE TABLE chatbot_product_uploads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chatbot_id UUID REFERENCES avatars(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name VARCHAR NOT NULL,
  file_path VARCHAR NOT NULL,
  file_size BIGINT,
  total_rows INTEGER,
  processed_rows INTEGER DEFAULT 0,
  successful_rows INTEGER DEFAULT 0,
  failed_rows INTEGER DEFAULT 0,
  status VARCHAR DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_log JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- 6. Create chatbot_promotions table
CREATE TABLE chatbot_promotions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chatbot_id UUID REFERENCES avatars(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title VARCHAR NOT NULL,
  description TEXT,
  promo_code VARCHAR,
  banner_image_url TEXT,
  thumbnail_url TEXT,
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT true,
  terms_and_conditions TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 7. Create indexes
CREATE INDEX idx_chatbot_products_chatbot_id ON chatbot_products(chatbot_id);
CREATE INDEX idx_chatbot_products_sku ON chatbot_products(sku);
CREATE INDEX idx_chatbot_products_category ON chatbot_products(category);
CREATE INDEX idx_chatbot_product_uploads_chatbot_id ON chatbot_product_uploads(chatbot_id);
CREATE INDEX idx_chatbot_promotions_chatbot_id ON chatbot_promotions(chatbot_id);
CREATE INDEX idx_avatars_industry ON avatars(industry);

-- 8. RLS policies
ALTER TABLE chatbot_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_product_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own products" ON chatbot_products
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own products" ON chatbot_products
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own products" ON chatbot_products
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own products" ON chatbot_products
  FOR DELETE USING (auth.uid() = user_id);

-- Similar RLS for other tables...

-- 9. Seed industry templates
INSERT INTO chatbot_templates (industry, template_name, description, business_context_template, compliance_rules, response_guidelines, sample_greetings) VALUES
('customer_service', 'Customer Support Assistant', 'Handle FAQ, troubleshooting, and customer inquiries',
 'You are a helpful customer support assistant for [COMPANY_NAME]. Your role is to answer customer questions quickly and professionally.',
 ARRAY['Never promise refunds without checking policy', 'Escalate billing issues to staff', 'Protect customer privacy'],
 ARRAY['Acknowledge customer concern', 'Provide clear solutions', 'Use simple language'],
 ARRAY['Hi! How can I help you today?', 'Selamat datang! Apa yang boleh saya bantu?']),

('ecommerce', 'Online Shop Assistant', 'Product recommendations and sales',
 'You are a friendly sales assistant for [COMPANY_NAME], an online shop in Malaysia.',
 ARRAY['State shipping costs clearly', 'Mention delivery time', 'Never make false product claims'],
 ARRAY['Ask about customer needs first', 'Recommend 2-3 products max', 'Include price in MYR'],
 ARRAY['Hi! Nak cari apa hari ni? 😊', 'Welcome! What are you looking for?']),

('real_estate', 'Property Inquiry Assistant', 'Property inquiries and viewings',
 'You are a professional property assistant for [COMPANY_NAME], a real estate agency in Malaysia.',
 ARRAY['Never promise property appreciation', 'State price clearly in MYR', 'Disclose if sold'],
 ARRAY['Ask budget and location', 'Highlight property features', 'Offer viewing schedule'],
 ARRAY['Hello! Looking to buy or rent?', 'Hi! Nak beli atau sewa rumah?']),

('appointment', 'Appointment Scheduler', 'Book appointments and check availability',
 'You are a professional appointment scheduler for [COMPANY_NAME]. Help customers book appointments.',
 ARRAY['Confirm appointment details clearly', 'Ask for contact info', 'State operating hours'],
 ARRAY['Greet warmly', 'Check availability', 'Send confirmation'],
 ARRAY['Hello! Would you like to book an appointment?', 'Nak tempah janji temu?']);
```

#### Week 2: Core Services

**Tasks:**
- [ ] Create `templateService.ts` - Load and manage templates
- [ ] Create `productService.ts` - CRUD for chatbot products
- [ ] Create `excelImportService.ts` - Parse and import Excel files
- [ ] Update `chatbotService.ts` - Include product context in chat
- [ ] Update `trainingService.ts` - Support business context instead of backstory
- [ ] Test services with sample data

### Phase 2: UI Components (Week 3-4)

**Goal:** Build simplified chatbot creation wizard

#### Week 3: Wizard Components

**Tasks:**
- [ ] Create `ChatbotCreationWizard.tsx` - Main wizard container
- [ ] Create `Step1IndustrySelector.tsx` - Template selection
- [ ] Create `Step2BasicInfo.tsx` - Company info, languages
- [ ] Create `Step3KnowledgeUpload.tsx` - Documents and products
- [ ] Create `TestChatPreview.tsx` - Quick test interface
- [ ] Wire up wizard flow with state management

**Component Structure:**
```
src/components/chatbot-creation/
├── ChatbotCreationWizard.tsx
├── Step1IndustrySelector.tsx
├── Step2BasicInfo.tsx
├── Step3KnowledgeUpload.tsx
├── TestChatPreview.tsx
└── TemplateCard.tsx
```

#### Week 4: Product Management UI

**Tasks:**
- [ ] Create `ProductGallery.tsx` - Grid view of products
- [ ] Create `ProductForm.tsx` - Add/edit product
- [ ] Create `ExcelUploadDialog.tsx` - Excel upload interface
- [ ] Create `ExcelPreviewTable.tsx` - Preview before import
- [ ] Create `ProductCard.tsx` - Single product display
- [ ] Test Excel upload with 1000+ products

### Phase 3: Integration & Testing (Week 5-6)

**Goal:** Connect everything, update APIs, test thoroughly

#### Week 5: API Updates

**Tasks:**
- [ ] Update `avatar-chat` edge function - Include products in context
- [ ] Update `avatar-config` edge function - Return business fields
- [ ] Create `chatbot-products` edge function - CRUD API
- [ ] Update `avatar-prompt` edge function - Use business_context
- [ ] Test API with Postman/Insomnia

**Example: Updated avatar-chat function**
```typescript
// supabase/functions/avatar-chat/index.ts

// Fetch chatbot with business context
const { data: chatbot } = await supabase
  .from('avatars')
  .select(`
    *,
    chatbot_products (
      sku, product_name, price, description, primary_image_url, in_stock
    )
  `)
  .eq('id', chatbotId)
  .single();

// Build system prompt with products
const systemPrompt = `${chatbot.business_context}

Available Products:
${chatbot.chatbot_products.map(p =>
  `- ${p.product_name} (RM${p.price}) ${p.in_stock ? '✓ In stock' : '✗ Out of stock'}`
).join('\n')}

Compliance Rules:
${chatbot.compliance_rules.join('\n- ')}

Response Guidelines:
${chatbot.response_guidelines.join('\n- ')}
`;

// Call OpenAI with latest model
const completion = await openai.chat.completions.create({
  model: chatbot.base_model || 'gpt-4o-mini', // Latest efficient model
  messages: [
    { role: 'system', content: systemPrompt },
    ...conversationHistory,
    { role: 'user', content: userMessage }
  ],
  temperature: 0.7,
  max_tokens: 500 // Limit tokens to reduce cost
});
```

#### Week 6: Testing & Bug Fixes

**Tasks:**
- [ ] End-to-end testing: Create chatbot → Test → Deploy
- [ ] Test all 4 industry templates
- [ ] Test Excel upload with various formats
- [ ] Test WhatsApp integration
- [ ] Test with Malaysia-specific scenarios (BM language, pricing in MYR)
- [ ] Performance testing (1000+ products)
- [ ] Fix bugs and edge cases

### Phase 4: Deployment & Launch (Week 7-8)

**Goal:** Deploy to production, marketing, onboard first users

#### Week 7: Production Deployment

**Tasks:**
- [ ] Run migration on production database
- [ ] Deploy updated edge functions
- [ ] Deploy new UI (chatbot wizard)
- [ ] Update routing: /create-avatar → /create-chatbot
- [ ] Smoke testing on production
- [ ] Setup monitoring and error tracking

#### Week 8: Marketing & Launch

**Tasks:**
- [ ] Update homepage with new branding
- [ ] Create demo video (BM and English)
- [ ] Write launch blog post
- [ ] Setup pricing page
- [ ] Launch on Facebook Malaysia business groups
- [ ] Launch on Shopee/Lazada seller forums
- [ ] Email existing users about new features
- [ ] Onboard first 10 beta users

---

## Technical Specifications

### AI Model Selection

**Recommended:** `gpt-4o-mini` (latest, fastest, cheapest)

**Why:**
- Fast response time (< 2 seconds)
- Low token cost (suitable for high-volume chatbot)
- Good quality for business conversations
- Supports function calling (future: product search)

**Alternative:** `gpt-4o` for premium users (Enterprise plan)

**Token Limits:**
```javascript
const CHATBOT_CONFIG = {
  model: 'gpt-4o-mini', // or user's fine-tuned model
  max_tokens: 500, // Limit response length
  temperature: 0.7, // Balanced creativity
  conversation_memory: 10 // Last 10 messages
};
```

### Malaysia-Specific Features

**1. Language Support**
```javascript
const SUPPORTED_LANGUAGES = {
  'en': 'English',
  'ms': 'Bahasa Malaysia',
  'zh': 'Mandarin (简体中文)'
};

// Allow language mixing (Manglish)
const TONE_SETTINGS = {
  language_mixing: true, // "Ok lah, no problem!"
  use_local_terms: true, // "Makan", "Lepak", "Jom"
};
```

**2. Currency & Pricing**
```javascript
const CURRENCY = 'MYR';
const formatPrice = (price: number) => `RM${price.toFixed(2)}`;
```

**3. Malaysia Holidays**
```javascript
const MALAYSIA_HOLIDAYS = [
  'Hari Raya',
  'Chinese New Year',
  'Deepavali',
  'Merdeka Day',
  'Christmas'
];
```

**4. Shipping Zones**
```javascript
const SHIPPING_ZONES = {
  'peninsular': 'Semenanjung Malaysia',
  'east_malaysia': 'Sabah & Sarawak'
};
```

### Performance Optimizations

**1. Product Search Optimization**
```sql
-- Full-text search index on products
CREATE INDEX idx_chatbot_products_search
ON chatbot_products
USING gin(to_tsvector('english', product_name || ' ' || description));

-- Fast category lookup
CREATE INDEX idx_chatbot_products_category_active
ON chatbot_products(category, is_active)
WHERE is_active = true;
```

**2. Caching Strategy**
```typescript
// Cache chatbot config for 5 minutes
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Cache frequently accessed products
const PRODUCT_CACHE_SIZE = 100; // Top 100 products
```

**3. Database Connection Pooling**
```typescript
// Supabase already handles this, but monitor:
// - Max connections: 100
// - Idle timeout: 10 minutes
```

### Security Considerations

**1. Input Validation**
```typescript
// Validate Excel upload
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_EXTENSIONS = ['.xlsx', '.xls'];
const MAX_ROWS = 10000; // Prevent abuse

// Sanitize user input
import DOMPurify from 'dompurify';
const cleanDescription = DOMPurify.sanitize(description);
```

**2. Rate Limiting**
```typescript
// Per chatbot per hour
const RATE_LIMITS = {
  messages_per_hour: 100,
  products_upload_per_day: 5,
  api_calls_per_minute: 30
};
```

**3. RLS (Row Level Security)**
- Already enabled on all tables
- Users can only access their own chatbots and products
- Admin users have separate policies

---

## Success Metrics

### Launch Goals (First 30 Days)

- [ ] 100 chatbots created
- [ ] 50 active users (sent 10+ messages)
- [ ] 20 paying customers (RM99+ plan)
- [ ] 10,000+ messages processed
- [ ] 5,000+ products uploaded
- [ ] 4.5+ star average rating
- [ ] < 5% error rate

### Long-term Goals (6 Months)

- [ ] 1,000+ chatbots created
- [ ] 300+ paying customers
- [ ] RM50,000+ MRR (Monthly Recurring Revenue)
- [ ] 50+ Enterprise clients (RM599 plan)
- [ ] 3+ case studies published
- [ ] Partnership with 1 major e-commerce platform

---

## Appendix

### Platform Name Final Recommendation

**ChatBiz** - Simple, memorable, Malaysia-friendly

**Alternatives:**
- BotSpace
- QuickChat.my
- TalkBiz
- ChatMaster

### Domain Strategy

**Primary:** chatbiz.my (Malaysia)
**International:** chatbiz.com
**Redirect:** botspace.com → chatbiz.com (if available)

### Marketing Tagline Ideas

**English:**
- "Build Your Business Chatbot in 5 Minutes"
- "24/7 Customer Service, Made Easy"
- "Chatbot for Malaysian SMEs"

**Bahasa Malaysia:**
- "Bina Chatbot Bisnes Dalam 5 Minit"
- "Khidmat Pelanggan 24/7, Mudah Sahaja"
- "Chatbot untuk PKS Malaysia"

---

## Next Steps

1. ✅ **Review this documentation** - Approve or request changes
2. 🎯 **Choose platform name** - ChatBiz or alternative
3. 🚀 **Begin Phase 1** - Database migration
4. 👥 **Recruit beta testers** - 5-10 Malaysian businesses
5. 📝 **Create marketing materials** - Landing page, demo video

---

**Document Status:** ✅ READY FOR IMPLEMENTATION
**Estimated Timeline:** 8 weeks (can be flexible for solo developer)
**Risk Level:** LOW (using existing infrastructure, validated feasibility)

**Questions? Contact:** [Your contact info]

