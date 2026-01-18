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

      // 2. Get product catalog with full details
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

      // 4. Get active promotions
      const { data: promotions } = await supabase
        .from('chatbot_promotions')
        .select('*')
        .eq('chatbot_id', chatbotId)
        .eq('is_active', true);

      const promotionsSummary = this.generatePromotionsSummary(promotions || []);

      // 5. Build context object
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

      // 6. Use AI to generate content-focused system prompt
      const generatedPrompt = await this.callAIToGeneratePrompt(
        context,
        productSummary,
        knowledgeSummary,
        promotionsSummary,
        products,
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
KNOWLEDGE BASE DOCUMENTS:
${fileSummary}

Total Documents: ${files.length}
These documents contain important business information that can be searched when answering customer questions.
`;
  }

  /**
   * Generate promotions summary for AI context
   */
  private static generatePromotionsSummary(promotions: any[]): string {
    if (promotions.length === 0) {
      return 'No active promotions currently.';
    }

    const promoList = promotions.map(p => {
      let promoText = `- ${p.title}`;
      if (p.discount_type === 'percentage') {
        promoText += `: ${p.discount_value}% off`;
      } else if (p.discount_type === 'fixed') {
        promoText += `: RM${p.discount_value} off`;
      }
      if (p.promo_code) {
        promoText += ` (Code: ${p.promo_code})`;
      }
      if (p.end_date) {
        promoText += ` - Valid until ${new Date(p.end_date).toLocaleDateString()}`;
      }
      return promoText;
    }).join('\n');

    return `
ACTIVE PROMOTIONS:
${promoList}

Total Active Promotions: ${promotions.length}
`;
  }

  /**
   * Call AI to generate optimized system prompt
   * NOTE: This prompt focuses on USER CONTENT (products, knowledge, promotions).
   * Guidelines/personality are handled by the n8n workflow template.
   */
  private static async callAIToGeneratePrompt(
    context: BusinessChatbotContext,
    productSummary: string,
    knowledgeSummary: string,
    promotionsSummary: string,
    products: any[],
    userId: string
  ): Promise<string> {
    try {
      // Get unique categories with product counts
      const categoryMap = new Map<string, number>();
      products.forEach(p => {
        const cat = p.category || 'Uncategorized';
        categoryMap.set(cat, (categoryMap.get(cat) || 0) + 1);
      });
      const categoriesWithCounts = Array.from(categoryMap.entries())
        .map(([cat, count]) => `- ${cat}: ${count} products`)
        .join('\n');

      // Get sample products per category (max 3 per category)
      const samplesByCategory = new Map<string, any[]>();
      products.forEach(p => {
        const cat = p.category || 'Uncategorized';
        if (!samplesByCategory.has(cat)) {
          samplesByCategory.set(cat, []);
        }
        if (samplesByCategory.get(cat)!.length < 3) {
          samplesByCategory.get(cat)!.push(p);
        }
      });

      const productExamples = Array.from(samplesByCategory.entries())
        .map(([cat, prods]) => {
          const prodList = prods.map(p =>
            `  • ${p.product_name} - RM${p.price} ${p.in_stock ? '(In Stock)' : '(Out of Stock)'}`
          ).join('\n');
          return `**${cat}:**\n${prodList}`;
        })
        .join('\n\n');

      // Build AI generation prompt - Focus on USER CONTENT only
      const generationPrompt = `Generate a CONTENT-FOCUSED system prompt for a Malaysian business chatbot. This prompt should focus on WHAT the business sells and knows, NOT how to respond (that's handled separately).

## BUSINESS IDENTITY

- **Chatbot Name:** ${context.chatbot_name}
- **Company:** ${context.company_name || 'Not specified'}
- **Industry:** ${context.industry || 'General Business'}

## BUSINESS DESCRIPTION

${context.business_context || 'A Malaysian business.'}

---

## PRODUCT CATALOG

${productSummary}

### Categories & Products:
${categoriesWithCounts || 'No categories yet'}

### Sample Products by Category:
${productExamples || 'No products uploaded yet'}

---

${promotionsSummary}

---

${knowledgeSummary}

---

## SUPPORTED LANGUAGES

The chatbot should be able to respond in: ${context.supported_languages?.join(', ') || 'English'}
Default language: ${context.default_language || 'English'}

---

## YOUR TASK

Create a system prompt that teaches the chatbot about THIS SPECIFIC BUSINESS and its content. The prompt should:

1. **Define the business identity** - Who is ${context.chatbot_name}? What does ${context.company_name || 'this business'} sell/do?

2. **Describe product categories in detail** - For each category above, explain:
   - What types of products are in this category
   - Price range
   - Key features customers ask about
   - How to recommend products from this category

3. **Include product knowledge** - Based on the sample products above:
   - Popular items to recommend
   - How to describe products naturally
   - What to say about pricing

4. **Promotions awareness** - Based on the promotions listed:
   - How to mention active deals
   - When to suggest promo codes

5. **Knowledge base topics** - Based on the uploaded documents:
   - What topics the chatbot can answer about
   - Types of questions it can handle

6. **Business-specific responses** - Example responses for:
   - "What do you sell?"
   - "What's your best product in [category]?"
   - "Do you have any deals?"
   - Common questions for this ${context.industry || 'business'} type

**IMPORTANT - DO NOT INCLUDE:**
- Response formatting guidelines (handled by workflow)
- Message splitting instructions (handled by workflow)
- Personality/tone guidelines (handled by workflow)
- Technical tool usage (handled by workflow)

**FORMAT:**
- 500-800 words
- Focus on CONTENT and BUSINESS KNOWLEDGE
- Include specific product names and prices from the data above
- Make it feel like training a new shop assistant about what you sell

Generate ONLY the content-focused prompt. Start with:
"You are ${context.chatbot_name}, the assistant for ${context.company_name || 'this business'}. Here's what you need to know about our products and services..."`;

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
          forUserId: userId,
          messages: [
            {
              role: 'system',
              content: 'You are an expert at creating business knowledge prompts for chatbots. Focus on teaching the chatbot about the specific products, categories, promotions, and business information. Do NOT include response formatting, personality guidelines, or technical instructions - only business content knowledge.'
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
      return this.generateContentTemplate(context, products, productSummary, knowledgeSummary, promotionsSummary);
    }
  }

  /**
   * Fallback: Generate content-focused template
   */
  private static generateContentTemplate(
    context: BusinessChatbotContext,
    products: any[],
    productSummary: string,
    knowledgeSummary: string,
    promotionsSummary: string
  ): string {
    const chatbotName = context.chatbot_name || 'Assistant';
    const companyName = context.company_name || 'our store';

    // Get categories
    const categories = [...new Set(products.map(p => p.category).filter(Boolean))];

    return `You are ${chatbotName}, the assistant for ${companyName}. Here's what you need to know about our products and services:

---

## ABOUT US

${context.business_context || `We are ${companyName}, a ${context.industry || 'business'} helping customers find what they need.`}

---

## OUR PRODUCTS

${productSummary}

### Product Categories:
${categories.length > 0
  ? categories.map(cat => {
      const catProducts = products.filter(p => p.category === cat);
      const priceRange = catProducts.length > 0
        ? `RM${Math.min(...catProducts.map(p => p.price)).toFixed(0)} - RM${Math.max(...catProducts.map(p => p.price)).toFixed(0)}`
        : 'Various prices';
      return `- **${cat}**: ${catProducts.length} products (${priceRange})`;
    }).join('\n')
  : 'Products available - ask about our catalog!'}

### Popular Products:
${products.slice(0, 5).map(p => `- ${p.product_name}: RM${p.price} ${p.in_stock ? '✓' : '(Out of stock)'}`).join('\n') || 'Check our latest products!'}

---

${promotionsSummary}

---

${knowledgeSummary}

---

## COMMON QUESTIONS

**"What do you sell?"**
We sell ${categories.length > 0 ? categories.join(', ') : 'various products'}. Total ${products.length} items in our catalog.

**"What's popular?"**
${products.filter(p => p.in_stock).slice(0, 3).map(p => p.product_name).join(', ') || 'Check our latest arrivals!'}

**"Do you have promotions?"**
${promotionsSummary.includes('No active') ? 'Check back soon for deals!' : 'Yes! We have active promotions running now.'}

---

## SUPPORTED LANGUAGES

Respond in: ${context.supported_languages?.join(', ') || 'English, 中文, Bahasa Malaysia'}
Match the customer's language exactly.`;
  }

  /**
   * Generate a basic content-focused template (used when no AI generation available)
   * This is a simpler version that just describes the business
   * Note: Guidelines/personality are handled by n8n workflow template
   */
  static generateBasicTemplate(context: BusinessChatbotContext): string {
    const chatbotName = context.chatbot_name || 'Assistant';
    const companyName = context.company_name || 'our store';

    return `You are ${chatbotName}, the assistant for ${companyName}.

## ABOUT US

${context.business_context || `We are ${companyName}, a ${context.industry || 'business'} helping customers find what they need.`}

Industry: ${context.industry || 'General Business'}

## SUPPORTED LANGUAGES

Respond in: ${context.supported_languages?.join(', ') || 'English, 中文, Bahasa Malaysia'}
Always match the customer's language exactly.

## NOTE

Product catalog and promotions will be fetched dynamically when customers ask.
Knowledge base documents can be searched for relevant information.`;
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
