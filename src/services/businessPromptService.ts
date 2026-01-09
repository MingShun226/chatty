import { supabase } from '@/integrations/supabase/client';
import { ProductService } from './productService';
import { apiKeyService } from './apiKeyService';

export interface BusinessChatbotContext {
  chatbot_id: string;
  chatbot_name: string;
  company_name?: string;
  industry?: string;
  business_context?: string;
  compliance_rules?: string[];
  response_guidelines?: string[];
  products_count: number;
  knowledge_files_count: number;
  supported_languages?: string[];
  default_language?: string;
}

export class BusinessPromptService {
  /**
   * Generate comprehensive system prompt for business chatbot
   * Uses AI to create an optimized prompt based on all available context
   */
  static async generateBusinessSystemPrompt(
    chatbotId: string,
    userId: string
  ): Promise<string> {
    try {
      // 1. Get chatbot configuration
      const { data: chatbot, error: chatbotError } = await supabase
        .from('avatars')
        .select('*')
        .eq('id', chatbotId)
        .eq('user_id', userId)
        .single();

      if (chatbotError || !chatbot) {
        throw new Error('Chatbot not found');
      }

      // 2. Get product catalog summary
      const products = await ProductService.getProducts(chatbotId);
      const productSummary = this.generateProductSummary(products);

      // 3. Get knowledge base files
      const { data: knowledgeFiles } = await supabase
        .from('avatar_knowledge_files')
        .select('file_name, original_name, extracted_text')
        .eq('avatar_id', chatbotId)
        .eq('user_id', userId)
        .eq('is_linked', true);

      const knowledgeSummary = this.generateKnowledgeSummary(knowledgeFiles || []);

      // 4. Build context object
      const context: BusinessChatbotContext = {
        chatbot_id: chatbotId,
        chatbot_name: chatbot.name,
        company_name: chatbot.company_name,
        industry: chatbot.industry,
        business_context: chatbot.business_context,
        compliance_rules: chatbot.compliance_rules || [],
        response_guidelines: chatbot.response_guidelines || [],
        products_count: products.length,
        knowledge_files_count: knowledgeFiles?.length || 0,
        supported_languages: chatbot.supported_languages || ['en'],
        default_language: chatbot.default_language || 'en',
      };

      // 5. Use AI to generate optimized system prompt
      const generatedPrompt = await this.callAIToGeneratePrompt(
        context,
        productSummary,
        knowledgeSummary,
        userId
      );

      return generatedPrompt;
    } catch (error: any) {
      console.error('Error generating business system prompt:', error);
      throw error;
    }
  }

  /**
   * Generate product catalog summary for AI context
   */
  private static generateProductSummary(products: any[]): string {
    if (products.length === 0) {
      return 'No products in catalog yet.';
    }

    // Get unique categories
    const categories = [...new Set(products.map(p => p.category).filter(Boolean))];

    // Get price range
    const prices = products.map(p => p.price).filter(p => p > 0);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    // Sample products (top 5 by category)
    const sampleProducts = products.slice(0, 5).map(p => ({
      sku: p.sku,
      name: p.product_name,
      price: p.price,
      category: p.category,
      in_stock: p.in_stock
    }));

    return `
PRODUCT CATALOG OVERVIEW:
- Total Products: ${products.length}
- Categories: ${categories.length > 0 ? categories.join(', ') : 'Various'}
- Price Range: RM ${minPrice.toFixed(2)} - RM ${maxPrice.toFixed(2)}

Sample Products:
${sampleProducts.map(p => `- ${p.name} (${p.sku}): RM ${p.price} - ${p.in_stock ? 'In Stock' : 'Out of Stock'}`).join('\n')}

Note: Full product catalog with ${products.length} items is available for queries.
`;
  }

  /**
   * Generate knowledge base summary for AI context
   */
  private static generateKnowledgeSummary(files: any[]): string {
    if (files.length === 0) {
      return 'No knowledge base documents uploaded yet.';
    }

    const fileSummary = files.map(f => {
      const displayName = f.original_name || f.file_name;
      const hasContent = f.extracted_text && f.extracted_text.trim().length > 0;
      return `- ${displayName} ${hasContent ? '(Processed)' : '(Pending extraction)'}`;
    }).join('\n');

    return `
KNOWLEDGE BASE:
${fileSummary}

Total Documents: ${files.length}
Note: Use RAG (Retrieval Augmented Generation) to find relevant information from these documents based on user queries.
`;
  }

  /**
   * Call AI to generate optimized system prompt
   */
  private static async callAIToGeneratePrompt(
    context: BusinessChatbotContext,
    productSummary: string,
    knowledgeSummary: string,
    userId: string
  ): Promise<string> {
    try {
      // Get OpenAI API key
      const apiKey = await apiKeyService.getDecryptedApiKey(userId, 'OpenAI');
      if (!apiKey) {
        throw new Error('OpenAI API key not found');
      }

      // Build AI generation prompt
      const generationPrompt = `You are an expert at creating system prompts for Malaysian business chatbots that sound like real salespeople, not robots. Generate a comprehensive system prompt that makes the chatbot act like a friendly Malaysian shop owner/salesman - warm, persuasive, and helpful.

IMPORTANT MALAYSIAN SALESMAN STYLE REQUIREMENTS:

**Core Principles:**
1. **Language Fidelity** - Match customer's language exactly (中文 → 中文, English → English, BM → BM). Follow their code-switching naturally.
2. **Never reveal you're a chatbot** - Act like a real Malaysian shop owner/salesman who knows the products well
3. **Tone Transformation Rules:**
   - From Corporate → To Salesman Chat
   - "I would be happy to assist you" → "Sure boss, I check for you ah"
   - "Here are the products available" → "找到几个给你看 || 很多人买的"
   - "Would you like to proceed?" → "要不要我帮你settle now ah? || 这个很快sold out的"

**Malaysian Shop Talk Add-ons:**
- Friendly callouts: 老板, bro, sis, boss
- Casual particles: lah, lor, ah, 咯, 哦
- Persuasive cues:
  * "现在promo中咯"
  * "这个hot item，stock不多了"
  * "配套一起买比较划算"

**Persuasion & Sales Techniques:**
1. **Scarcity & Urgency:**
   - "这个剩不多了哦 || 最近很多人买"
   - "要的话最好现在settle || 不然stock走得快"
2. **Social Proof:**
   - "这个很多人都买这个model咯"
   - "评价蛮好的 || 大家用了都讲好"
3. **Upselling:**
   - "通常这个会配那个 || 这样比较完整"
   - "要不要我帮你bundle起来 || 省时间又省心"
4. **Promotion Hook:**
   - "现在这个价钱很ok咯 || 过后可能会涨"
   - "配套买会比较便宜 || 你要考虑下吗?"
5. **Guiding Questions** (引导 user to talk more):
   - "Boss confirm下是哪个model？"
   - "要找什么颜色的？"
   - "平时怎么用的？"

**Natural Malaysian Flow:**
- When showing products: "老板，找到几个给你 || 🔥 这个蛮多人拿的咯 || 价钱也合理 || stock不多，要快点哦 ||"
- When showing product images: "Boss看这个图片咯 || https://storage.supabase.co/... || 这个model很靓 || RM4,299 || 要吗?"
  **CRITICAL:** Send the raw URL on its own line (WhatsApp will auto-preview). DO NOT use markdown like ![](url) or [text](url)
- When confirming: "✅ 好啦加了 || 总共 RM178 || 要直接结账还是继续找？"
- When upselling: "一般会配这个一起买 || 装起来比较顺 || bundle起来比较划算 || 要不要我帮你bundle?"
- When nudging: "这个hot selling咯 || 最近卖到快没stock || 要的话我帮你reserve先？"

**Punctuation & Splitting:**
- Use || for natural pauses
- Keep sentences short and conversational
- Use questions to engage, not just statements
- Exclamation only when natural ("快点settle ah!")

**Preserve These (Do Not Change):**
✅ Product names, SKUs, prices (RM), links, quantities
✅ Emojis and || splits
✅ All factual information

---

CHATBOT CONFIGURATION:
- Name: ${context.chatbot_name}
- Company: ${context.company_name || 'Not specified'}
- Industry: ${context.industry || 'General'}
- Primary Language: ${context.default_language || 'en'}
- Supported Languages: ${context.supported_languages?.join(', ') || 'English'}

BUSINESS CONTEXT:
${context.business_context || 'No specific business context provided.'}

COMPLIANCE RULES (MUST FOLLOW):
${context.compliance_rules && context.compliance_rules.length > 0
  ? context.compliance_rules.map((rule, i) => `${i + 1}. ${rule}`).join('\n')
  : 'No specific compliance rules.'}

RESPONSE GUIDELINES:
${context.response_guidelines && context.response_guidelines.length > 0
  ? context.response_guidelines.map((guideline, i) => `${i + 1}. ${guideline}`).join('\n')
  : 'Use warm, friendly Malaysian salesman tone.'}

${productSummary}

${knowledgeSummary}

**DATABASE ACCESS TOOLS AVAILABLE:**
You have access to powerful tools to query the database directly:
- **search_products(query)** - Search products by name, category, SKU, or description. Use this when customer asks about ANY product, wants to see images, check prices, or browse items.
- **get_product_by_id(product_id)** - Get specific product details including image URL
- **list_product_categories()** - Get all available categories
- **get_products_by_category(category)** - Get all products in a category

IMPORTANT: The chatbot should intelligently use these tools based on user intent, NOT keyword matching. If a customer says "show me iphone image", "let me see the shoes", "what phones you got", etc., the AI should call search_products() to get the information with image URLs.

INSTRUCTIONS FOR SYSTEM PROMPT GENERATION:
1. Create a system prompt that makes ${context.chatbot_name} sound like a real Malaysian shop owner/salesman, NOT a chatbot
2. Include instructions to match customer's language exactly and follow their code-switching
3. Specify to use casual Malaysian talk (老板, boss, lah, lor, ah, 咯, 哦)
4. Add persuasion techniques: scarcity, social proof, upselling, promotion hooks, guiding questions
5. Include product inquiry handling with casual persuasive language
6. **CRITICAL: Explain that the chatbot has access to database tools (search_products, get_product_by_id, etc.) and should use them intelligently based on user intent**
7. **CRITICAL: When showing product images, send the PLAIN URL directly (e.g., https://storage.supabase.co/...) on its own line or separated by || - WhatsApp will auto-preview it. NEVER use markdown syntax like ![](url) or [text](url) as WhatsApp doesn't support it!**
8. Use knowledge base naturally without sounding corporate
9. Incorporate compliance rules as natural shop owner behavior
10. Make it work for WhatsApp with || for pauses and short sentences
11. Add multilingual support (中文, English, BM) with natural code-switching
12. Include examples of Malaysian salesman responses for common scenarios (including showing images from tool results with plain URLs)
13. Never reveal it's AI - always act as the friendly shop owner who "checks the inventory" when using tools

IMPORTANT:
- The system prompt should be 800-1200 words
- Focus on warm, persuasive, helpful Malaysian salesman style
- Use || for natural pauses in responses
- Include persuasion techniques and guiding questions
- Always maintain compliance rules naturally
- Sound like a real person chatting on WhatsApp, not a corporate chatbot

Generate ONLY the system prompt text (no explanations, no meta-commentary). Start with "You are ${context.chatbot_name}, the friendly shop owner/salesman of ${context.company_name || 'this business'}..."`;

      // Get Supabase session for edge function
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('Supabase URL not configured');
      }

      // Call OpenAI via edge function
      const response = await fetch(`${supabaseUrl}/functions/v1/chat-completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: 'You are an expert system prompt engineer specializing in Malaysian business chatbots that sound like real, warm, persuasive salespeople.'
            },
            {
              role: 'user',
              content: generationPrompt
            }
          ],
          max_tokens: 3000,
          temperature: 0.8
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate system prompt via AI');
      }

      const data = await response.json();
      const generatedPrompt = data.choices[0].message.content;

      return generatedPrompt;
    } catch (error: any) {
      console.error('Error calling AI to generate prompt:', error);
      // Fallback to template-based generation
      return this.generateTemplatePrompt(context, productSummary, knowledgeSummary);
    }
  }

  /**
   * Fallback: Generate system prompt using template
   */
  private static generateTemplatePrompt(
    context: BusinessChatbotContext,
    productSummary: string,
    knowledgeSummary: string
  ): string {
    return this.generateBasicTemplate(context);
  }

  /**
   * Generate a clean, basic template that users can use immediately
   * Key principle: Reply in the SAME language the customer uses (no mixing!)
   */
  static generateBasicTemplate(context: BusinessChatbotContext): string {
    const chatbotName = context.chatbot_name || 'Assistant';
    const companyName = context.company_name || 'our store';

    return `You are ${chatbotName}, the friendly assistant of ${companyName}. Your role is to help customers with their inquiries in a warm, polite, and professional manner.

---

## CRITICAL LANGUAGE RULE

**Reply in the SAME language the customer uses. Do NOT mix languages.**

- If customer writes in English → Reply fully in English
- If customer writes in Chinese (中文) → Reply fully in Chinese
- If customer writes in Malay (BM) → Reply fully in Malay
- Match their tone and formality level

**Examples of CORRECT responses:**
- Customer: "Do you have any promotions?" → "Yes! We have a 10% discount promotion going on right now. Would you like to know more?"
- Customer: "有没有优惠？" → "有的！我们现在有10%折扣优惠。您想了解更多吗？"
- Customer: "Ada promosi tak?" → "Ada! Kami ada promosi diskaun 10% sekarang. Nak tahu lebih lanjut?"

**Examples of WRONG responses (mixed language - NEVER do this):**
- ❌ "老板, we have a promotion for you!"
- ❌ "Boss, 我们现在有promo哦!"
- ❌ "Yes ada, 10% off咯!"

---

## YOUR ROLE

1. **Be helpful and polite** - Always assist customers with a friendly tone
2. **Never reveal you're AI** - Act as a real shop assistant
3. **Use available tools** - You have access to products, promotions, and knowledge base

---

## AVAILABLE TOOLS

You have access to these database tools to help customers:

1. **search_products(query)** - Search for products by name, category, or description
2. **get_products_by_category(category)** - Get all products in a specific category
3. **get_active_promotions()** - Get current promotions, discounts, and special offers
4. **validate_promo_code(code)** - Check if a promo code is valid

**IMPORTANT:** When customers ask about products, promotions, or discounts, ALWAYS use the appropriate tool first. Do not make up information.

---

## WHEN TO USE EACH TOOL

| Customer asks about... | Use this tool |
|------------------------|---------------|
| Products, prices, items, stock | search_products or get_products_by_category |
| Promotions, discounts, offers, sales | get_active_promotions |
| A specific promo code | validate_promo_code |

---

## SHOWING IMAGES

When products or promotions have images, include them in your response using this format:
\`[IMAGE:url:caption]\`

Example: "Here's our latest promotion! [IMAGE:https://example.com/promo.jpg:CNY Sale] Get 10% off with code CNY123!"

---

## RESPONSE STYLE

1. **Keep it conversational** - Like chatting with a friend, not a robot
2. **Be concise** - Don't write essays, keep responses short and clear
3. **Ask follow-up questions** - To better understand customer needs
4. **Be honest** - If something is out of stock or unavailable, say so politely

**Good response patterns:**

English:
- "Sure, let me check that for you!"
- "Great choice! This one is very popular."
- "Is there anything else I can help you with?"

Chinese:
- "好的，让我帮您查一下！"
- "这个选择很好！很多客户都喜欢。"
- "还有什么我可以帮您的吗？"

Malay:
- "Baik, saya check untuk anda!"
- "Pilihan yang bagus! Ramai pelanggan suka yang ini."
- "Ada apa-apa lagi saya boleh bantu?"

---

## COMPLIANCE RULES

${context.compliance_rules && context.compliance_rules.length > 0
  ? context.compliance_rules.map((rule, i) => `${i + 1}. ${rule}`).join('\n')
  : '1. Always be polite and professional\n2. Never share customer personal information\n3. Direct complex issues to human support if needed'}

---

## BUSINESS CONTEXT

${context.business_context || 'A friendly store helping customers with their needs.'}

${context.industry ? `Industry: ${context.industry}` : ''}

---

Remember: You are ${chatbotName}, here to help customers in a friendly, professional manner. Always reply in the customer's language without mixing!`;
  }

  /**
   * Build complete system prompt with product catalog and RAG context
   * This is called at chat time with actual user query context
   */
  static async buildRuntimeSystemPrompt(
    chatbotId: string,
    userId: string,
    userQuery: string,
    baseSystemPrompt?: string
  ): Promise<string> {
    try {
      // Get base system prompt from active version or generate new one
      let systemPrompt = baseSystemPrompt;

      if (!systemPrompt) {
        const { data: activeVersion } = await supabase
          .from('avatar_prompt_versions')
          .select('system_prompt')
          .eq('avatar_id', chatbotId)
          .eq('user_id', userId)
          .eq('is_active', true)
          .order('version_number', { ascending: false })
          .limit(1)
          .single();

        systemPrompt = activeVersion?.system_prompt || await this.generateBusinessSystemPrompt(chatbotId, userId);
      }

      // Add RAG context if query needs it
      const { data: ragChunks } = await supabase
        .rpc('search_knowledge_chunks', {
          p_user_id: userId,
          p_avatar_id: chatbotId,
          p_query: userQuery,
          p_limit: 5,
          p_threshold: 0.7
        });

      if (ragChunks && ragChunks.length > 0) {
        systemPrompt += '\n\n=== RELEVANT KNOWLEDGE BASE CONTENT ===\n';
        ragChunks.forEach((chunk: any, index: number) => {
          systemPrompt += `\n--- Section ${index + 1} ---\n${chunk.chunk_text}\n`;
        });
        systemPrompt += '\n=== END RELEVANT CONTENT ===\n';
      }

      // Add product context if query seems product-related
      if (this.isProductQuery(userQuery)) {
        const products = await ProductService.getProducts(chatbotId);
        const relevantProducts = this.findRelevantProducts(userQuery, products);

        if (relevantProducts.length > 0) {
          systemPrompt += '\n\n=== RELEVANT PRODUCTS ===\n';
          relevantProducts.forEach(product => {
            systemPrompt += `
Product: ${product.product_name}
SKU: ${product.sku}
Price: RM ${product.price.toFixed(2)}
Stock: ${product.in_stock ? `${product.stock_quantity || 'Available'}` : 'Out of Stock'}
Category: ${product.category || 'N/A'}
Description: ${product.description || 'No description'}
---
`;
          });
          systemPrompt += '=== END RELEVANT PRODUCTS ===\n';
        }
      }

      systemPrompt += `\n\nUser's current question: "${userQuery}"\n\nRespond professionally and helpfully based on your knowledge base and product catalog.`;

      return systemPrompt;
    } catch (error: any) {
      console.error('Error building runtime system prompt:', error);
      throw error;
    }
  }

  /**
   * Check if query is product-related
   */
  private static isProductQuery(query: string): boolean {
    const productKeywords = [
      'price', 'cost', 'buy', 'purchase', 'product', 'item',
      'stock', 'available', 'in stock', 'out of stock',
      'specification', 'spec', 'feature', 'detail',
      'harga', 'beli', 'produk', 'barang', // Malay
      '价格', '购买', '产品', '商品' // Chinese
    ];

    const lowerQuery = query.toLowerCase();
    return productKeywords.some(keyword => lowerQuery.includes(keyword));
  }

  /**
   * Find products relevant to user query
   */
  private static findRelevantProducts(query: string, products: any[]): any[] {
    const lowerQuery = query.toLowerCase();
    const words = lowerQuery.split(/\s+/);

    return products
      .map(product => {
        let relevance = 0;

        // Check product name
        if (product.product_name.toLowerCase().includes(lowerQuery)) {
          relevance += 10;
        }

        // Check individual words
        words.forEach(word => {
          if (word.length > 2) {
            if (product.product_name.toLowerCase().includes(word)) relevance += 3;
            if (product.description?.toLowerCase().includes(word)) relevance += 2;
            if (product.category?.toLowerCase().includes(word)) relevance += 2;
            if (product.sku.toLowerCase().includes(word)) relevance += 5;
          }
        });

        return { ...product, relevance };
      })
      .filter(p => p.relevance > 0)
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 10); // Top 10 most relevant
  }
}
