import { supabase } from '@/integrations/supabase/client';
import { ProductService } from './productService';

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
        .select('file_name, original_name')
        .eq('avatar_id', chatbotId)
        .eq('user_id', userId)
        .eq('processing_status', 'processed');

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
      return `- ${f.original_name || f.file_name}`;
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
   * NOTE: This prompt focuses on BUSINESS PERSONALITY only.
   * Tools and function calls are handled by the n8n workflow template.
   */
  private static async callAIToGeneratePrompt(
    context: BusinessChatbotContext,
    productSummary: string,
    knowledgeSummary: string,
    userId: string
  ): Promise<string> {
    try {
      // Build AI generation prompt - Focus on CONTENT and PERSONALITY only
      // NO tools info - that's handled by n8n workflow
      const generationPrompt = `You are an expert at creating system prompts for Malaysian business chatbots. Generate a comprehensive system prompt that defines the chatbot's PERSONALITY and BUSINESS KNOWLEDGE.

**IMPORTANT:** This prompt should ONLY define:
1. Chatbot personality and tone
2. Business context and knowledge
3. Product categories and how to describe them
4. Response style and language handling
5. Compliance and guidelines

**DO NOT INCLUDE:**
- Tool/function usage instructions (handled separately by workflow)
- Database query instructions
- Technical implementation details

---

## CHATBOT IDENTITY

- **Name:** ${context.chatbot_name}
- **Company:** ${context.company_name || 'Not specified'}
- **Industry:** ${context.industry || 'General Business'}
- **Type:** ${context.chatbot_id ? 'E-commerce/Sales Assistant' : 'Customer Service'}

---

## BUSINESS CONTEXT

${context.business_context || 'A Malaysian business helping customers with their inquiries.'}

---

## LANGUAGE HANDLING

**Critical Rule:** Match the customer's language exactly.
- Customer writes English → Reply in English
- Customer writes 中文 → Reply in 中文
- Customer writes BM → Reply in BM

**Malaysian-Style Tone (when appropriate):**
- Friendly callouts: 老板, bro, sis, boss
- Casual particles: lah, lor, ah, 咯, 哦
- But always match customer's formality level

---

${productSummary}

---

${knowledgeSummary}

---

## COMPLIANCE RULES (MUST FOLLOW)

${context.compliance_rules && context.compliance_rules.length > 0
  ? context.compliance_rules.map((rule, i) => `${i + 1}. ${rule}`).join('\n')
  : `1. Never share customer personal information
2. Direct complex issues to human support if needed
3. Be honest about product availability
4. Do not make promises about delivery times unless confirmed`}

---

## RESPONSE GUIDELINES

${context.response_guidelines && context.response_guidelines.length > 0
  ? context.response_guidelines.map((guideline, i) => `${i + 1}. ${guideline}`).join('\n')
  : `1. Keep responses concise and helpful
2. Use WhatsApp-friendly formatting (|| for line breaks)
3. Ask follow-up questions to understand customer needs
4. Be warm and friendly, not corporate`}

---

## INSTRUCTIONS FOR PROMPT GENERATION

Create a system prompt for ${context.chatbot_name} that:

1. **Defines the personality** - Warm, helpful Malaysian shop assistant
2. **Sets the tone** - Friendly but professional, matching customer's language
3. **Describes the business** - What products/services are offered
4. **Lists product categories** - Based on the catalog summary above
5. **Explains response style** - WhatsApp-friendly, concise, engaging
6. **Includes compliance rules** - As natural behavior guidelines
7. **Handles common scenarios** - Greetings, product inquiries, pricing questions, out of stock

**Format Requirements:**
- 600-900 words
- Use clear sections with headers
- Include example responses for each language
- Focus on personality and knowledge, NOT technical implementation

Generate ONLY the system prompt text. Start with:
"You are ${context.chatbot_name}, the friendly assistant of ${context.company_name || 'this business'}..."`;

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
      // Pass forUserId so admin can generate using target user's API key
      const response = await fetch(`${supabaseUrl}/functions/v1/chat-completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          forUserId: userId, // Allow admin to use target user's API key
          messages: [
            {
              role: 'system',
              content: 'You are an expert system prompt engineer. Create prompts that focus on personality and business knowledge, NOT technical implementation.'
            },
            {
              role: 'user',
              content: generationPrompt
            }
          ],
          max_tokens: 2000,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to generate system prompt via AI');
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
