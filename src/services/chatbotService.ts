import { apiKeyService } from './apiKeyService';
import { supabase } from '@/integrations/supabase/client';
import { RAGService } from './ragService';
import { TrainingService } from './trainingService';
import { SmartPromptService } from './smartPromptService';
import { MemoryService } from './memoryService';
import { ProductService, Product } from './productService';
import { PromotionService, Promotion } from './promotionService';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | Array<{
    type: 'text' | 'image_url';
    text?: string;
    image_url?: { url: string; detail?: 'low' | 'high' | 'auto' };
  }>;
}

export interface AvatarContext {
  id: string;
  name: string;
  backstory?: string;
  personality_traits?: string[];
  mbti_type?: string;
  hidden_rules?: string;
  customSystemPrompt?: string;
  fineTunedModelId?: string;
}

export const chatbotService = {
  // Helper method to determine max tokens based on model
  getMaxTokensForModel(model: string): number {
    if (model.includes('gpt-4o-mini')) {
      return 2000; // gpt-4o-mini has higher token limits
    } else if (model.includes('gpt-4o')) {
      return 1500; // gpt-4o models
    } else if (model.includes('gpt-4')) {
      return 1000; // Regular gpt-4 models
    } else if (model.includes('gpt-3.5-turbo')) {
      return 500; // gpt-3.5-turbo models
    } else {
      return 1000; // Default for unknown models
    }
  },
  async sendMessage(
    userId: string,
    message: string,
    avatarContext: AvatarContext,
    conversationHistory: ChatMessage[] = [],
    model: string = 'gpt-3.5-turbo'
  ): Promise<string> {
    try {
      // Get OpenAI API key from stored keys
      const apiKey = await apiKeyService.getDecryptedApiKey(userId, 'OpenAI');

      if (!apiKey) {
        throw new Error('No OpenAI API key found. Please add one in Settings > API Keys.');
      }

      // Check if avatar has an active fine-tuned model
      const { data: avatarProfile, error: avatarError } = await supabase
        .from('avatars')
        .select('active_fine_tuned_model, use_fine_tuned_model, base_model')
        .eq('id', avatarContext.id)
        .single();

      if (avatarError) {
        console.error('Error fetching avatar profile:', avatarError);
      }

      // Determine which model to use (priority: fine-tuned > provided > base > default)
      let modelToUse = model;
      if (avatarProfile?.use_fine_tuned_model && avatarProfile?.active_fine_tuned_model) {
        modelToUse = avatarProfile.active_fine_tuned_model;
        console.log('Using fine-tuned model:', modelToUse);
      } else if (avatarProfile?.base_model) {
        modelToUse = avatarProfile.base_model;
      } else if (avatarContext.fineTunedModelId) {
        // Legacy support for fineTunedModelId in context
        modelToUse = avatarContext.fineTunedModelId;
      }

      // Use RAG to find relevant content for the user's message
      const ragResults = await RAGService.searchRelevantChunks(
        message,
        userId,
        avatarContext.id,
        5, // Get top 5 most relevant chunks
        0.7 // Similarity threshold
      );

      // Get basic knowledge base info (for files without RAG processing)
      const knowledgeBase = await this.getKnowledgeBaseContent(userId, avatarContext.id);

      // Get avatar memories for context injection
      const memories = await MemoryService.getRecentMemories(avatarContext.id, userId, 10);
      const memoryContext = MemoryService.buildMemoryContext(memories);

      // Build memory image references for GPT-4o
      const memoryImageReferences = await this.buildMemoryImageReferences(memories);

      // Get products and promotions for the chatbot
      const [productsWithPromos, activePromotions] = await Promise.all([
        this.getProductsWithPromotions(avatarContext.id),
        PromotionService.getActivePromotions(avatarContext.id)
      ]);

      // Format product and promotion context
      const productCatalogContext = this.formatProductCatalog(productsWithPromos);
      const promotionsContext = this.formatPromotions(activePromotions);

      // Create system prompt with RAG-enhanced context, memories, and smart patterns
      const baseSystemPrompt = await this.createSystemPromptWithRAG(avatarContext, knowledgeBase, ragResults.chunks, message, userId);
      const systemPromptWithContext = baseSystemPrompt + memoryContext + memoryImageReferences + productCatalogContext + promotionsContext;
      const systemPrompt = await SmartPromptService.generateSmartPrompt(userId, avatarContext.id, message, systemPromptWithContext);

      // Prepare messages for OpenAI
      const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory.slice(-30), // Keep last 30 messages for context
        { role: 'user', content: message }
      ];

      // Define function tools for memory image retrieval
      const tools = [
        {
          type: 'function',
          function: {
            name: 'get_memory_images',
            description: 'Retrieve images from a specific memory to show to the user. Use this when discussing or referencing a specific memory event and you want to share the photos from that memory.',
            parameters: {
              type: 'object',
              properties: {
                memory_id: {
                  type: 'string',
                  description: 'The ID of the memory to retrieve images from'
                },
                reason: {
                  type: 'string',
                  description: 'Brief explanation of why you want to show this memory'
                }
              },
              required: ['memory_id', 'reason']
            }
          }
        }
      ];

      // Get Supabase session for authentication
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Not authenticated. Please sign in.');
      }

      // Call OpenAI API via Supabase Edge Function (to avoid CORS issues)
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('Supabase URL not configured');
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/chat-completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          model: modelToUse,
          messages,
          max_tokens: this.getMaxTokensForModel(modelToUse),
          temperature: 0.7,
          tools: tools,
          tool_choice: 'auto'
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        if (response.status === 401) {
          throw new Error('Invalid API key. Please check your OpenAI API key in Settings.');
        } else if (response.status === 429) {
          throw new Error('API rate limit exceeded. Please try again later.');
        } else {
          throw new Error(errorData.error?.message || `API error: ${response.status}`);
        }
      }

      const data = await response.json();

      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Invalid response from OpenAI API');
      }

      const assistantMessage = data.choices[0].message;

      // Track usage for fine-tuned models
      if (avatarProfile?.use_fine_tuned_model && avatarProfile?.active_fine_tuned_model && data.usage) {
        try {
          await supabase.rpc('update_fine_tune_usage', {
            p_user_id: userId,
            p_avatar_id: avatarContext.id,
            p_fine_tuned_model: avatarProfile.active_fine_tuned_model,
            p_input_tokens: data.usage.prompt_tokens || 0,
            p_output_tokens: data.usage.completion_tokens || 0
          });
        } catch (usageError) {
          console.error('Failed to track fine-tune usage:', usageError);
          // Don't throw - this is non-critical
        }
      }

      // Check if the model wants to call a function
      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        // Handle function call for retrieving memory images
        const toolCall = assistantMessage.tool_calls[0];

        if (toolCall.function.name === 'get_memory_images') {
          const args = JSON.parse(toolCall.function.arguments);
          const memoryId = args.memory_id;

          // Retrieve memory images
          const images = await MemoryService.getMemoryImages(memoryId, userId);

          if (images && images.length > 0) {
            // Add function call and result to messages
            messages.push({
              role: 'assistant',
              content: assistantMessage.content || ''
            });

            messages.push({
              role: 'system',
              content: `Function result: Retrieved ${images.length} image(s) from memory. The images will be automatically displayed to the user. DO NOT include image attachments or markdown image syntax in your response. Just write your message naturally - the photos will appear automatically below your text.`
            });

            // Make a second API call with the function result
            const secondResponse = await fetch(`${supabaseUrl}/functions/v1/chat-completions`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
              },
              body: JSON.stringify({
                model: modelToUse,
                messages,
                max_tokens: this.getMaxTokensForModel(modelToUse),
                temperature: 0.7
              })
            });

            if (!secondResponse.ok) {
              throw new Error('Failed to get final response after function call');
            }

            const secondData = await secondResponse.json();
            let finalResponse = secondData.choices[0].message.content;

            // Clean up any attachment references or markdown image syntax
            finalResponse = this.cleanImageReferences(finalResponse);

            // Return response with image metadata
            return JSON.stringify({
              type: 'text_with_images',
              text: finalResponse,
              images: images.map(img => ({
                url: img.image_url,
                caption: img.caption || '',
                is_primary: img.is_primary
              }))
            });
          }
        }
      }

      let avatarResponse = assistantMessage.content;

      // Clean up any image references from the response
      avatarResponse = this.cleanImageReferences(avatarResponse);

      // Learn from this conversation (async, don't block response)
      SmartPromptService.learnFromConversations(
        userId,
        avatarContext.id,
        message,
        avatarResponse,
        'neutral', // Default to neutral, user can provide feedback later
        Date.now().toString() // Use timestamp as session ID
      ).catch(error => {
        console.warn('Failed to learn from conversation:', error);
      });

      return avatarResponse;

    } catch (error) {
      console.error('Chatbot service error:', error);

      if (error instanceof Error) {
        throw error;
      } else {
        throw new Error('Failed to get response from chatbot');
      }
    }
  },

  async getKnowledgeBaseContent(userId: string, avatarId: string): Promise<string[]> {
    try {
      const { data: knowledgeFiles, error } = await supabase
        .from('avatar_knowledge_files')
        .select('file_name, original_name, extracted_text, file_size, content_type')
        .eq('user_id', userId)
        .eq('avatar_id', avatarId)
        .eq('is_linked', true);

      if (error) {
        console.error('Error fetching knowledge base:', error);
        return [];
      }

      if (!knowledgeFiles || knowledgeFiles.length === 0) {
        return [];
      }

      const results = [];

      for (const file of knowledgeFiles) {
        if (file.extracted_text && file.extracted_text.trim().length > 0) {
          // Use extracted text if available
          results.push(`--- Content from ${file.file_name} ---\n${file.extracted_text}`);
        } else {
          // Temporary fallback: indicate file exists but needs processing
          const displayName = file.original_name || file.file_name;
          results.push(`--- Document: ${displayName} ---
File Type: ${file.content_type || 'PDF'}
Size: ${file.file_size ? Math.round(file.file_size / 1024) + ' KB' : 'Unknown'}
Status: PDF content extraction pending - this document is available but text needs to be processed.
Note: I can see this document exists in my knowledge base, but the text content hasn't been extracted yet. You may need to re-upload or process this file for full text access.`);
        }
      }

      return results;

    } catch (error) {
      console.error('Error fetching knowledge base content:', error);
      return [];
    }
  },

  async createSystemPromptWithRAG(avatarContext: AvatarContext, knowledgeBase: string[], ragChunks: any[], userQuery: string, userId: string): Promise<string> {
    // Use customSystemPrompt if provided, otherwise try to get trained prompt version
    let basePrompt = `You are ${avatarContext.name}, an AI avatar with a unique personality.`;

    if (avatarContext.customSystemPrompt) {
      // Use the selected version's system prompt directly
      basePrompt = avatarContext.customSystemPrompt;
    } else {
      try {
        const activeVersion = await TrainingService.getActivePromptVersion(avatarContext.id, userId);
        if (activeVersion) {
          // Use the trained system prompt as the base
          basePrompt = activeVersion.system_prompt;

          // Add personality traits from training if available
          if (activeVersion.personality_traits && activeVersion.personality_traits.length > 0) {
            basePrompt += `\n\nYour trained personality traits: ${activeVersion.personality_traits.join(', ')}`;
          }

          // Add behavior rules from training if available
          if (activeVersion.behavior_rules && activeVersion.behavior_rules.length > 0) {
            basePrompt += `\n\nTrained behavior guidelines: ${activeVersion.behavior_rules.join(' ')}`;
          }

          // Apply response style if available
          if (activeVersion.response_style) {
            const style = activeVersion.response_style as any;
            if (style.formality) {
              basePrompt += `\n\nCommunication style: ${style.formality}`;
            }
            if (style.tone) {
              basePrompt += `\n\nTone: ${style.tone}`;
            }
            if (style.emoji_usage) {
              basePrompt += `\n\nEmoji usage: ${style.emoji_usage}`;
            }
          }
        } else {
          // Fall back to original avatar data if no trained version exists
          if (avatarContext.backstory) {
            basePrompt += `\n\nYour backstory: ${avatarContext.backstory}`;
          }

          if (avatarContext.personality_traits && avatarContext.personality_traits.length > 0) {
            basePrompt += `\n\nYour personality traits: ${avatarContext.personality_traits.join(', ')}`;
          }

          if (avatarContext.mbti_type) {
            basePrompt += `\n\nYour MBTI type: ${avatarContext.mbti_type}`;
          }

          if (avatarContext.hidden_rules) {
            basePrompt += `\n\nImportant behavioral guidelines: ${avatarContext.hidden_rules}`;
          }
        }
      } catch (error) {
        console.warn('Could not load trained prompt, using default:', error);
        // Fall back to original avatar data
        if (avatarContext.backstory) {
          basePrompt += `\n\nYour backstory: ${avatarContext.backstory}`;
        }

        if (avatarContext.personality_traits && avatarContext.personality_traits.length > 0) {
          basePrompt += `\n\nYour personality traits: ${avatarContext.personality_traits.join(', ')}`;
        }

        if (avatarContext.mbti_type) {
          basePrompt += `\n\nYour MBTI type: ${avatarContext.mbti_type}`;
        }

        if (avatarContext.hidden_rules) {
          basePrompt += `\n\nImportant behavioral guidelines: ${avatarContext.hidden_rules}`;
        }
      }
    }

    // Add RAG-retrieved content if available
    if (ragChunks && ragChunks.length > 0) {
      basePrompt += RAGService.formatRetrievedContext(ragChunks);
    } else if (knowledgeBase && knowledgeBase.length > 0) {
      // Fallback to basic knowledge base
      basePrompt += `\n\n=== KNOWLEDGE BASE ===\nYou have access to the following documents:`;
      knowledgeBase.forEach(content => {
        const truncatedContent = content.length > 1000
          ? content.substring(0, 1000) + '...[content truncated]'
          : content;
        basePrompt += `\n\n${truncatedContent}`;
      });
      basePrompt += `\n\n=== END KNOWLEDGE BASE ===\n`;
    }

    basePrompt += `\n\nUser's current question: "${userQuery}"\n\nStay in character and respond as ${avatarContext.name} would, based on your personality, background, and available knowledge. Be helpful, engaging, and authentic to your character. If you have relevant information from your knowledge base, use it to provide accurate and detailed responses.`;

    return basePrompt;
  },

  createSystemPrompt(avatarContext: AvatarContext, knowledgeBase: string[] = []): string {
    let prompt = `You are ${avatarContext.name}, an AI avatar with a unique personality.`;

    if (avatarContext.backstory) {
      prompt += `\n\nYour backstory: ${avatarContext.backstory}`;
    }

    if (avatarContext.personality_traits && avatarContext.personality_traits.length > 0) {
      prompt += `\n\nYour personality traits: ${avatarContext.personality_traits.join(', ')}`;
    }

    if (avatarContext.mbti_type) {
      prompt += `\n\nYour MBTI type: ${avatarContext.mbti_type}`;
    }

    if (avatarContext.hidden_rules) {
      prompt += `\n\nImportant behavioral guidelines: ${avatarContext.hidden_rules}`;
    }

    // Add knowledge base content if available
    if (knowledgeBase && knowledgeBase.length > 0) {
      prompt += `\n\n=== KNOWLEDGE BASE ===\nYou have access to the following documents and information. Use this knowledge to provide accurate, detailed responses when relevant:`;

      knowledgeBase.forEach((content, index) => {
        // Limit each document to ~1000 characters to avoid token limits
        const truncatedContent = content.length > 1000
          ? content.substring(0, 1000) + '...[content truncated]'
          : content;
        prompt += `\n\n${truncatedContent}`;
      });

      prompt += `\n\n=== END KNOWLEDGE BASE ===\n`;
      prompt += `When answering questions, prioritize information from your knowledge base when relevant. If you reference specific information from the documents, you can mention that you're drawing from your knowledge base.`;
    }

    prompt += `\n\nStay in character and respond as ${avatarContext.name} would, based on your personality, background, and available knowledge. Be helpful, engaging, and authentic to your character.`;

    return prompt;
  },

  async buildMemoryImageReferences(memories: any[]): Promise<string> {
    if (!memories || memories.length === 0) {
      return '';
    }

    let imageReferences = '\n\n=== MEMORY PHOTO REFERENCES ===\n';
    imageReferences += 'You have access to photos from these memories. You can retrieve and show these photos to the user by calling the get_memory_images function:\n\n';

    for (const memory of memories) {
      if (memory.images && memory.images.length > 0) {
        imageReferences += `Memory ID: ${memory.id}\n`;
        imageReferences += `Title: ${memory.title}\n`;
        imageReferences += `Date: ${memory.memory_date}\n`;
        imageReferences += `Photos available: ${memory.images.length}\n`;
        imageReferences += `Description: ${memory.memory_summary}\n`;
        imageReferences += `---\n`;
      }
    }

    imageReferences += '\n**IMPORTANT**: When you call get_memory_images, the photos will be automatically displayed to the user below your message. DO NOT include image markdown syntax like ![](attachment://...) or mention attachments in your text. Just write your message naturally and the images will appear automatically.\n';
    imageReferences += '=== END MEMORY PHOTO REFERENCES ===\n';

    return imageReferences;
  },

  /**
   * Get products with active promotions applied
   */
  async getProductsWithPromotions(chatbotId: string): Promise<Array<Product & {
    has_discount: boolean;
    discounted_price: number | null;
    discount_display: string | null;
    promotion_title: string | null;
  }>> {
    try {
      const [products, promotions] = await Promise.all([
        ProductService.getProducts(chatbotId),
        PromotionService.getActivePromotions(chatbotId)
      ]);

      // Build a map of product IDs to promotions
      const productPromotions = new Map<string, Promotion>();

      for (const promo of promotions) {
        if (promo.applies_to === 'products' && promo.applies_to_product_ids) {
          for (const productId of promo.applies_to_product_ids) {
            if (!productPromotions.has(productId)) {
              productPromotions.set(productId, promo);
            }
          }
        }
      }

      // Apply promotions to products
      return products.map(product => {
        const promo = productPromotions.get(product.id || '');

        if (promo && promo.discount_type && promo.discount_value) {
          let discountedPrice: number;
          let discountDisplay: string;

          if (promo.discount_type === 'percentage') {
            discountedPrice = product.price * (1 - promo.discount_value / 100);
            discountDisplay = `${promo.discount_value}% OFF`;
          } else {
            discountedPrice = Math.max(0, product.price - promo.discount_value);
            discountDisplay = `RM${promo.discount_value} OFF`;
          }

          return {
            ...product,
            has_discount: true,
            discounted_price: Math.round(discountedPrice * 100) / 100,
            discount_display: discountDisplay,
            promotion_title: promo.title
          };
        }

        return {
          ...product,
          has_discount: false,
          discounted_price: null,
          discount_display: null,
          promotion_title: null
        };
      });
    } catch (error) {
      console.error('Error fetching products with promotions:', error);
      return [];
    }
  },

  /**
   * Format products for AI context
   */
  formatProductCatalog(products: Array<Product & {
    has_discount: boolean;
    discounted_price: number | null;
    discount_display: string | null;
  }>): string {
    if (!products || products.length === 0) {
      return '';
    }

    let productInfo = '\n\n=== PRODUCT CATALOG ===\n';
    productInfo += `You have ${products.length} products available:\n\n`;

    // Group by category
    const byCategory = new Map<string, typeof products>();
    for (const product of products) {
      const cat = product.category || 'Uncategorized';
      if (!byCategory.has(cat)) {
        byCategory.set(cat, []);
      }
      byCategory.get(cat)!.push(product);
    }

    for (const [category, catProducts] of byCategory) {
      productInfo += `📁 ${category}:\n`;
      for (const p of catProducts) {
        const priceInfo = p.has_discount && p.discounted_price
          ? `~~${p.currency} ${p.price}~~ NOW ${p.currency} ${p.discounted_price} (${p.discount_display})`
          : `${p.currency} ${p.price}`;

        productInfo += `  • ${p.product_name} (SKU: ${p.sku})\n`;
        productInfo += `    Price: ${priceInfo}\n`;
        productInfo += `    Stock: ${p.in_stock ? 'In Stock ✓' : 'Out of Stock ✗'}\n`;
        if (p.description) {
          productInfo += `    Description: ${p.description.substring(0, 150)}${p.description.length > 150 ? '...' : ''}\n`;
        }
        if (p.tags && p.tags.length > 0) {
          productInfo += `    Tags: ${p.tags.join(', ')}\n`;
        }
        productInfo += '\n';
      }
    }

    productInfo += '=== END PRODUCT CATALOG ===\n';
    productInfo += 'When customers ask about products, prices, or availability, use this catalog to provide accurate information.\n';

    return productInfo;
  },

  /**
   * Format active promotions for AI context
   */
  formatPromotions(promotions: Promotion[]): string {
    if (!promotions || promotions.length === 0) {
      return '';
    }

    let promoInfo = '\n\n=== ACTIVE PROMOTIONS ===\n';
    promoInfo += `There are ${promotions.length} active promotions:\n\n`;

    for (const promo of promotions) {
      promoInfo += `🎁 ${promo.title}\n`;
      if (promo.description) {
        promoInfo += `   ${promo.description}\n`;
      }
      if (promo.promo_code) {
        promoInfo += `   Promo Code: ${promo.promo_code}\n`;
      }
      if (promo.discount_type && promo.discount_value) {
        const discountText = promo.discount_type === 'percentage'
          ? `${promo.discount_value}% OFF`
          : `RM${promo.discount_value} OFF`;
        promoInfo += `   Discount: ${discountText}\n`;
      }
      if (promo.end_date) {
        promoInfo += `   Valid until: ${new Date(promo.end_date).toLocaleDateString()}\n`;
      }
      if (promo.terms_and_conditions) {
        promoInfo += `   Terms: ${promo.terms_and_conditions.substring(0, 100)}${promo.terms_and_conditions.length > 100 ? '...' : ''}\n`;
      }
      promoInfo += '\n';
    }

    promoInfo += '=== END PROMOTIONS ===\n';
    promoInfo += 'Mention relevant promotions when customers ask about deals, discounts, or when recommending products.\n';

    return promoInfo;
  },

  cleanImageReferences(text: string): string {
    if (!text) return text;

    // Remove markdown image syntax: ![alt](url)
    let cleaned = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, '');

    // Remove standalone attachment references
    cleaned = cleaned.replace(/attachment:\/\/[a-f0-9-]+/gi, '');

    // Remove lines that only contain image references
    cleaned = cleaned.split('\n')
      .filter(line => {
        const trimmed = line.trim();
        return trimmed.length > 0 &&
               !trimmed.startsWith('![') &&
               !trimmed.match(/^attachment:\/\//i);
      })
      .join('\n');

    // Clean up extra whitespace
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();

    return cleaned;
  }
};