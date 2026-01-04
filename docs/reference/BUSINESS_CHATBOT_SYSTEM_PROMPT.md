# Business Chatbot System Prompt Architecture

## Overview

Your business chatbot now has a comprehensive system prompt that integrates:
- ✅ Business settings (company name, industry, context)
- ✅ Compliance rules and response guidelines
- ✅ **Full product catalog** (automatic product lookup)
- ✅ **Knowledge base** (RAG-powered document search)
- ✅ **AI-powered prompt generation**
- ✅ **WhatsApp/n8n integration ready**

---

## Components Created

### 1. BusinessPromptService (`src/services/businessPromptService.ts`)

**Purpose**: Generate comprehensive, AI-powered system prompts for business chatbots

**Key Features**:
- Analyzes all chatbot configuration (settings, compliance, guidelines)
- Summarizes product catalog (categories, price ranges, sample products)
- Summarizes knowledge base documents
- Uses GPT-4o-mini to generate optimized prompts
- Fallback to template-based generation if AI fails
- Runtime prompt building with product/knowledge context

**Main Methods**:
```typescript
// Generate complete system prompt using AI
generateBusinessSystemPrompt(chatbotId, userId): Promise<string>

// Build runtime prompt with user query context
buildRuntimeSystemPrompt(chatbotId, userId, userQuery, basePrompt): Promise<string>
```

---

### 2. Avatar-Chat Edge Function (Updated)

**Location**: `supabase/functions/avatar-chat/index.ts`

**Enhancements**:
- ✅ Loads business context (company, industry, compliance rules, guidelines)
- ✅ Detects product-related queries automatically
- ✅ Searches product catalog and adds relevant products to context
- ✅ Uses RAG to find relevant knowledge base content
- ✅ Works with n8n for WhatsApp integration

**Product Detection**: Automatically detects keywords like:
- English: price, cost, buy, purchase, product, stock, available
- Malay: harga, beli, produk, barang
- Chinese: 价格, 购买, 产品

**Smart Product Matching**:
```typescript
// If user asks: "Do you have Samsung phones?"
// System will:
1. Search all products
2. Match "Samsung" + "phone" against product names
3. Add top 10 relevant products to system prompt
4. Include: name, SKU, price, stock, category, description
```

---

### 3. AI Prompt Generator Component

**Location**: `src/components/business-chatbot/AIPromptGenerator.tsx`

**Usage**: Add to your training/version tab

```tsx
import { AIPromptGenerator } from '@/components/business-chatbot/AIPromptGenerator';

<AIPromptGenerator
  chatbotId={chatbot.id}
  userId={user.id}
  onPromptGenerated={(prompt) => {
    console.log('New prompt created:', prompt);
    // Refresh versions list
  }}
/>
```

**Features**:
- 🤖 One-click AI generation
- 👁️ Preview generated prompt
- ✏️ Edit before saving
- 💾 Save as new version (auto-activates)
- 📝 Creates version with name "AI Generated v{number}"

---

### 4. Business Chatbot Test Interface

**Location**: `src/components/business-chatbot/BusinessChatbotTest.tsx`

**Purpose**: Test chatbot with full context (same as WhatsApp will use)

**Features**:
- ✅ Uses same API endpoint as n8n (`avatar-chat`)
- ✅ Shows context info (products count, knowledge files, system prompt status)
- ✅ Real-time chat testing
- ✅ Suggested questions based on available context
- ✅ Conversation history support
- ✅ Message timestamps

**Usage**:
```tsx
import { BusinessChatbotTest } from '@/components/business-chatbot/BusinessChatbotTest';

// In your dashboard or test tab
<BusinessChatbotTest
  chatbotId={chatbot.id}
  chatbotName={chatbot.name}
/>
```

---

## How It All Works Together

### Flow 1: Generating System Prompt

```
1. User clicks "Generate System Prompt with AI"
   ↓
2. BusinessPromptService:
   - Fetches chatbot settings
   - Gets product catalog summary
   - Gets knowledge base summary
   ↓
3. Calls GPT-4o-mini with comprehensive context
   ↓
4. AI generates optimized prompt (800-1200 words)
   ↓
5. User reviews and edits in preview dialog
   ↓
6. Save as new prompt version (auto-activated)
```

### Flow 2: WhatsApp User Sends Message (via n8n)

```
1. User sends WhatsApp message: "What products do you have?"
   ↓
2. n8n webhook → avatar-chat edge function
   ↓
3. Edge function loads:
   - Active system prompt version
   - RAG search for relevant knowledge
   - Product catalog search (detected "products" keyword)
   ↓
4. Builds comprehensive system prompt:
   ╔════════════════════════════════════════╗
   ║ Base System Prompt (from version)      ║
   ║ ────────────────────────────────────   ║
   ║ + Compliance Rules                     ║
   ║ + Response Guidelines                  ║
   ║ + Relevant Knowledge Base Content      ║
   ║ + Product Catalog Overview/Details     ║
   ║ + User's Current Question              ║
   ╚════════════════════════════════════════╝
   ↓
5. Sends to OpenAI with full context
   ↓
6. Returns response to n8n → WhatsApp
```

### Flow 3: Testing with Business Chatbot Test

```
1. Open test interface
   ↓
2. Shows context badges:
   [✓ System Prompt] [50 Products] [3 Knowledge Files]
   ↓
3. User types: "Show me laptops under RM 3000"
   ↓
4. Calls avatar-chat edge function (same as WhatsApp)
   ↓
5. System detects product query
   ↓
6. Searches products: category="Laptops" AND price<3000
   ↓
7. Adds matched products to prompt
   ↓
8. Returns response with specific products
```

---

## Example Generated System Prompt

Here's what the AI might generate:

```
You are ABC Electronics Bot, a professional AI chatbot representing ABC Electronics.

**ABOUT THE BUSINESS:**
We are ABC Electronics, a leading electronics retailer in Malaysia. We sell smartphones,
laptops, home appliances, and accessories at competitive prices with 1-year warranty.

**COMPLIANCE RULES (MUST FOLLOW):**
1. Never make promises about delivery dates - always say "please check with our team"
2. Don't provide specific technical support - direct to warranty center
3. Always mention our 14-day return policy for defective items

**RESPONSE GUIDELINES:**
1. Be polite and professional at all times
2. Use simple, clear language suitable for WhatsApp
3. Keep responses concise (2-3 short paragraphs max)
4. Always confirm product availability before quoting prices

**PRODUCT CATALOG OVERVIEW:**
- Total Products: 156
- Categories: Mobile Phones, Laptops, Tablets, Accessories, Home Appliances
- Price Range: RM 29.90 - RM 8,999.00

Sample Products:
- Samsung Galaxy S24 (PHONE001): RM 5,299 - In Stock
- Dell XPS 15 Laptop (LAP001): RM 6,799 - In Stock
- Sony WH-1000XM5 (ACC015): RM 1,599 - Out of Stock

**KNOWLEDGE BASE:**
- ABC Electronics Store Policy.pdf (Processed)
- Product Warranty Guide.pdf (Processed)
- Shipping and Returns.pdf (Processed)

**YOUR CAPABILITIES:**
1. **Product Inquiries**: Answer questions about products, pricing, stock availability from catalog
2. **Knowledge Base**: Use documents to provide accurate info about policies and procedures
3. **Customer Service**: Handle inquiries professionally and efficiently
4. **Multilingual Support**: Communicate in English, Malay, Chinese

**HOW TO RESPOND:**
- Be helpful, professional, and friendly
- Use information from product catalog and knowledge base
- If uncertain, admit it and offer to escalate
- Keep responses concise for WhatsApp
- When discussing products, mention: name, price, stock status

**IMPORTANT:**
Stay in character as ABC Electronics Bot. Assist customers effectively while maintaining
professionalism and accuracy. Always follow compliance rules.
```

---

## Integration with n8n for WhatsApp

### Setup Steps:

1. **Create Platform API Key** (in Settings → API Keys)
   - Scope: `chat`
   - Restricted to this chatbot

2. **n8n Workflow**:
   ```
   WhatsApp Trigger
   ↓
   HTTP Request Node:
     - URL: https://your-project.supabase.co/functions/v1/avatar-chat
     - Method: POST
     - Headers:
       - x-api-key: YOUR_API_KEY
       - Content-Type: application/json
     - Body:
       {
         "avatar_id": "chatbot-id-here",
         "message": "{{$json.message}}",
         "conversation_history": [],
         "model": "gpt-4o-mini"
       }
   ↓
   WhatsApp Response Node
   ```

3. **Response Format**:
   ```json
   {
     "success": true,
     "avatar_id": "...",
     "message": "Hello! We have 156 products...",
     "metadata": {
       "model": "gpt-4o-mini",
       "knowledge_chunks_used": 2,
       "memories_accessed": 0
     }
   }
   ```

---

## Testing Checklist

Before deploying to WhatsApp:

- [ ] Generate system prompt with AI
- [ ] Upload knowledge base PDFs
- [ ] Import product catalog (Excel)
- [ ] Test in Business Chatbot Test interface:
  - [ ] Ask about products ("What laptops do you have?")
  - [ ] Ask about policies ("What's your return policy?")
  - [ ] Ask about pricing ("Products under RM 1000?")
  - [ ] Test multilingual (if enabled)
  - [ ] Test compliance rules (try to make it break rules)
- [ ] Create Platform API Key
- [ ] Set up n8n workflow
- [ ] Test via WhatsApp

---

## Benefits of This Architecture

1. **Automatic Context Injection**: Products and knowledge automatically added based on query
2. **Smart Product Matching**: Relevance scoring finds best matching products
3. **Multilingual Ready**: Detects Malay/Chinese product keywords
4. **WhatsApp Optimized**: Concise, conversational responses
5. **Consistent with n8n**: Test interface uses same API as production
6. **AI-Powered**: Generates professional, context-aware prompts
7. **Compliance Enforced**: Rules are part of the system prompt
8. **Scalable**: Works with thousands of products via search

---

## File Reference

**Services**:
- `src/services/businessPromptService.ts` - AI prompt generation
- `src/services/productService.ts` - Product catalog CRUD
- `src/services/excelImportService.ts` - Excel product import
- `src/services/imageUploadService.ts` - Product image handling

**Components**:
- `src/components/business-chatbot/AIPromptGenerator.tsx` - AI prompt gen UI
- `src/components/business-chatbot/BusinessChatbotTest.tsx` - Test interface
- `src/components/business-chatbot/ChatbotSettingsModern.tsx` - Settings UI
- `src/components/business-chatbot/ProductGalleryFull.tsx` - Product management

**Edge Functions**:
- `supabase/functions/avatar-chat/index.ts` - Main chat API (WhatsApp endpoint)

**Database**:
- `avatars` - Chatbot settings (business_context, compliance_rules, etc.)
- `avatar_prompt_versions` - System prompt versions
- `chatbot_products` - Product catalog
- `avatar_knowledge_files` - Knowledge base PDFs

---

## Next Steps

1. Add `<AIPromptGenerator>` component to your training/version tab
2. Add `<BusinessChatbotTest>` component to a test tab
3. Generate first system prompt
4. Upload knowledge base and products
5. Test thoroughly
6. Set up n8n for WhatsApp
7. Go live! 🚀
