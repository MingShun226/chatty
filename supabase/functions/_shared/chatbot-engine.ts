/**
 * Chatbot Engine - Shared Module
 *
 * This module contains the core chatbot logic extracted from avatar-chat.
 * It can be reused by multiple edge functions (avatar-chat, whatsapp-webhook, etc.)
 *
 * Provides:
 * - Prompt building with RAG and memories
 * - OpenAI function calling with tool execution
 * - Product search and catalog access
 */

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export interface ChatbotContext {
  avatarId: string
  userId: string
  message: string
  conversationHistory?: Array<{
    role: 'user' | 'assistant' | 'system'
    content: string
  }>
  model?: string
  platform?: string // 'web', 'whatsapp', 'n8n', etc.
  phoneNumber?: string // For WhatsApp context
}

export interface ChatbotResponse {
  response: string
  metadata: {
    model: string
    knowledgeChunksUsed: number
    memoriesAccessed: number
    toolCallsExecuted: number
    platform?: string
    priceQueryDetected?: boolean
    escalatedToHuman?: boolean
  }
}

/**
 * Process a chatbot message and generate a response
 *
 * @param context - The chat context (avatar, message, history, etc.)
 * @param supabase - Supabase client
 * @returns Chatbot response with metadata
 */
export async function processChatbotMessage(
  context: ChatbotContext,
  supabase: SupabaseClient
): Promise<ChatbotResponse> {
  const {
    avatarId,
    userId,
    message,
    conversationHistory = [],
    model = 'gpt-3.5-turbo',
    platform = 'unknown',
    phoneNumber
  } = context

  // =======================================
  // 1. GET AVATAR CONFIGURATION
  // =======================================
  const { data: avatar, error: avatarError } = await supabase
    .from('avatars')
    .select('*')
    .eq('id', avatarId)
    .eq('user_id', userId)
    .single()

  if (avatarError || !avatar) {
    throw new Error('Avatar not found')
  }

  // =======================================
  // 2. GET ACTIVE PROMPT VERSION
  // =======================================
  const { data: promptVersion } = await supabase
    .from('avatar_prompt_versions')
    .select('*')
    .eq('avatar_id', avatarId)
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('version_number', { ascending: false })
    .limit(1)
    .single()

  // =======================================
  // 3. GET KNOWLEDGE BASE (RAG)
  // =======================================
  const { data: ragChunks } = await supabase
    .rpc('search_knowledge_chunks', {
      p_user_id: userId,
      p_avatar_id: avatarId,
      p_query: message,
      p_limit: 5,
      p_threshold: 0.7
    })

  // =======================================
  // 4. GET RECENT MEMORIES
  // =======================================
  const { data: memories } = await supabase
    .from('avatar_memories')
    .select(`
      *,
      memory_images (*)
    `)
    .eq('avatar_id', avatarId)
    .eq('user_id', userId)
    .order('memory_date', { ascending: false })
    .limit(10)

  // =======================================
  // 5. BUILD SYSTEM PROMPT
  // =======================================
  let systemPrompt = buildSystemPrompt(
    avatar,
    promptVersion,
    ragChunks,
    memories,
    message,
    platform,
    phoneNumber
  )

  // =======================================
  // 6. GET OPENAI API KEY (admin-assigned > user's key)
  // =======================================
  let openaiApiKey: string | null = null

  // First check for admin-assigned API key (platform-managed)
  const { data: adminKey } = await supabase
    .from('admin_assigned_api_keys')
    .select('api_key_encrypted')
    .eq('user_id', userId)
    .eq('service', 'openai')
    .eq('is_active', true)
    .maybeSingle()

  if (adminKey?.api_key_encrypted) {
    try {
      openaiApiKey = atob(adminKey.api_key_encrypted)
    } catch (e) {
      console.error('Failed to decrypt admin-assigned API key')
    }
  }

  // Fall back to user's own key if no admin-assigned key
  if (!openaiApiKey) {
    const { data: userKey } = await supabase
      .from('user_api_keys')
      .select('api_key_encrypted')
      .eq('user_id', userId)
      .ilike('service', 'openai')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (userKey?.api_key_encrypted) {
      try {
        openaiApiKey = atob(userKey.api_key_encrypted)
      } catch (e) {
        console.error('Failed to decrypt user API key')
      }
    }
  }

  if (!openaiApiKey) {
    throw new Error('No OpenAI API key configured. Please contact your administrator.')
  }

  // =======================================
  // 7. DEFINE TOOLS (FUNCTION CALLING)
  // =======================================
  const tools = buildTools()

  // =======================================
  // 7.5. SYSTEM-LEVEL PRICE QUERY DETECTION
  // =======================================
  // If prices are hidden and user asks about pricing, return system response immediately
  if (avatar.price_visible === false) {
    const priceKeywords = [
      'price', 'pricing', 'cost', 'how much', 'berapa', 'harga',
      '价格', '多少钱', '几钱', 'rm', 'ringgit', 'dollar', '$',
      'quote', 'quotation', 'rate', 'fee', 'charge',
      'budget', 'expensive', 'cheap', 'afford'
    ]
    const messageLower = message.toLowerCase()
    const isPriceQuery = priceKeywords.some(keyword => messageLower.includes(keyword))

    if (isPriceQuery) {
      // Return system-level response for price queries
      const priceHiddenResponse = `Wait a moment ya || Let me connect you with our team who can help with pricing! 🙌

Our team will get back to you shortly with the pricing information you need.

In the meantime, is there anything else I can help you with? Like product features, availability, or recommendations?`

      return {
        response: priceHiddenResponse,
        metadata: {
          model: 'system-response',
          knowledgeChunksUsed: 0,
          memoriesAccessed: 0,
          toolCallsExecuted: 0,
          platform,
          priceQueryDetected: true,
          escalatedToHuman: true
        }
      }
    }
  }

  // =======================================
  // 8. PREPARE MESSAGES
  // =======================================
  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.slice(-30), // Keep last 30 messages for context
    { role: 'user', content: message }
  ]

  // =======================================
  // 9. CALL OPENAI WITH FUNCTION CALLING
  // =======================================
  const { finalResponse, toolCallsExecuted } = await callOpenAIWithTools(
    messages,
    avatar,
    model,
    openaiApiKey,
    tools,
    supabase,
    avatarId
  )

  // =======================================
  // 10. RETURN RESPONSE
  // =======================================
  return {
    response: finalResponse,
    metadata: {
      model: avatar.fine_tuned_model_id || model,
      knowledgeChunksUsed: ragChunks?.length || 0,
      memoriesAccessed: memories?.length || 0,
      toolCallsExecuted,
      platform
    }
  }
}

/**
 * Build comprehensive system prompt
 */
function buildSystemPrompt(
  avatar: any,
  promptVersion: any,
  ragChunks: any[],
  memories: any[],
  message: string,
  platform: string,
  phoneNumber?: string
): string {
  let systemPrompt = `You are ${avatar.name}, an AI chatbot.`

  // Add platform context
  if (platform === 'whatsapp' && phoneNumber) {
    systemPrompt += `\n\n**PLATFORM:** You are chatting on WhatsApp with ${phoneNumber}.`
  }

  // Use active prompt version if available
  if (promptVersion) {
    systemPrompt = promptVersion.system_prompt

    if (promptVersion.personality_traits?.length > 0) {
      systemPrompt += `\n\nYour personality traits: ${promptVersion.personality_traits.join(', ')}`
    }

    if (promptVersion.behavior_rules?.length > 0) {
      systemPrompt += `\n\nBehavior guidelines: ${promptVersion.behavior_rules.join(' ')}`
    }

    if (promptVersion.compliance_rules?.length > 0) {
      systemPrompt += `\n\nCompliance rules (MUST FOLLOW):\n${promptVersion.compliance_rules.map((r: string, i: number) => `${i + 1}. ${r}`).join('\n')}`
    }

    if (promptVersion.response_guidelines?.length > 0) {
      systemPrompt += `\n\nResponse guidelines:\n${promptVersion.response_guidelines.map((g: string, i: number) => `${i + 1}. ${g}`).join('\n')}`
    }
  } else {
    // Fallback to avatar settings
    if (avatar.business_context) {
      systemPrompt += `\n\n**BUSINESS CONTEXT:**\n${avatar.business_context}`
    } else if (avatar.backstory) {
      systemPrompt += `\n\nYour backstory: ${avatar.backstory}`
    }

    if (avatar.company_name) {
      systemPrompt += `\n\nCompany: ${avatar.company_name}`
    }

    if (avatar.industry) {
      systemPrompt += `\nIndustry: ${avatar.industry}`
    }

    if (avatar.compliance_rules?.length > 0) {
      systemPrompt += `\n\nCompliance rules (MUST FOLLOW):\n${avatar.compliance_rules.map((r: string, i: number) => `${i + 1}. ${r}`).join('\n')}`
    }

    if (avatar.response_guidelines?.length > 0) {
      systemPrompt += `\n\nResponse guidelines:\n${avatar.response_guidelines.map((g: string, i: number) => `${i + 1}. ${g}`).join('\n')}`
    }

    if (avatar.personality_traits?.length > 0) {
      systemPrompt += `\n\nYour personality traits: ${avatar.personality_traits.join(', ')}`
    }
  }

  // Add RAG context if available
  if (ragChunks && ragChunks.length > 0) {
    systemPrompt += '\n\n=== RELEVANT KNOWLEDGE BASE CONTENT ===\n'
    ragChunks.forEach((chunk: any, index: number) => {
      systemPrompt += `\n--- Section ${index + 1} ---\n${chunk.chunk_text}\n`
    })
    systemPrompt += '\n=== END RELEVANT CONTENT ===\n'
  }

  // Add memory context if available
  if (memories && memories.length > 0) {
    systemPrompt += '\n\n=== YOUR MEMORIES ===\n'
    memories.forEach((memory: any) => {
      systemPrompt += `\n- ${memory.title} (${memory.memory_date}): ${memory.memory_summary}\n`
    })
    systemPrompt += '\n=== END MEMORIES ===\n'
  }

  // Add price visibility rules to prompt
  if (avatar.price_visible === false) {
    systemPrompt += `\n\n**CRITICAL - PRICE POLICY:**
You MUST NOT reveal any product prices to customers. When customers ask about prices:
1. Do NOT mention any price, cost, RM amount, or pricing information
2. Tell them: "For pricing information, please contact our team directly and we'll be happy to assist you."
3. Offer to help with other product information (features, availability, etc.)
4. If they insist on pricing, politely redirect them to contact the business directly`
  }

  systemPrompt += `\n\nUser's current question: "${message}"\n\nRespond professionally and helpfully. Use the available tools to access product information, search the knowledge base, or get any data you need from the database.

**MANDATORY TOOL USAGE:**
1. General product questions ("do you have phones?", "what do you sell?", "show me products", "looking for X") → MUST call browse_full_catalog FIRST
   - This gives you the COMPLETE catalog so you can intelligently recommend products
   - Example: User asks "do you have phones?" → browse_full_catalog → you see "iPhone 15 Pro Max" → recommend it
2. Only use search_products if you already know the EXACT product name or SKU
3. When customer asks about promotions, discounts, sales, deals, offers, promo codes, 优惠, 折扣, 促销 - ALWAYS call get_active_promotions first
4. When customer mentions a specific promo code - ALWAYS call validate_promo_code to verify it
5. DO NOT guess or make up promotions. Only share promotions returned by the get_active_promotions tool${avatar.price_visible === false ? '\n6. NEVER mention product prices - prices are hidden for this business' : ''}

**SMART PRODUCT MATCHING:**
When you have the full catalog from browse_full_catalog:
- "phones" or "mobile" → Look for products with "Phone", "iPhone", "Samsung", etc.
- "laptop" or "computer" → Look for "MacBook", "Laptop", "PC", etc.
- Use YOUR intelligence to match user intent with products, not just keyword matching
- Recommend relevant products even if the exact word doesn't match

**SHOWING PRODUCT IMAGES:**
When products have has_image: true, include the DISPLAY_IMAGE value in your response to show the image.
Example: if DISPLAY_IMAGE is "[IMAGE:https://xxx.supabase.co/storage/xxx.jpg:iPhone 15]", include that exact string in your reply.`

  return systemPrompt
}

/**
 * Build tools array for OpenAI function calling
 */
function buildTools() {
  return [
    {
      type: 'function',
      function: {
        name: 'browse_full_catalog',
        description: 'RECOMMENDED: Get the COMPLETE product catalog with all items. Use this FIRST when customers ask about products, what you sell, or want to browse. This gives you full visibility to intelligently recommend products. Better than search_products for general questions like "do you have phones?" or "what do you sell?"',
        parameters: {
          type: 'object',
          properties: {
            include_out_of_stock: {
              type: 'boolean',
              description: 'Whether to include out-of-stock items (default: false)',
              default: false
            }
          }
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'search_products',
        description: 'Search for products by exact name match. Only use this if you know the exact product name or SKU. For general questions like "phones" or "electronics", use browse_full_catalog instead.',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Exact product name or SKU to search for'
            },
            limit: {
              type: 'number',
              description: 'Maximum number of products to return (default: 10)',
              default: 10
            }
          },
          required: ['query']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_product_by_id',
        description: 'Get detailed information about a specific product by its ID, including image URL.',
        parameters: {
          type: 'object',
          properties: {
            product_id: {
              type: 'string',
              description: 'The unique ID of the product'
            }
          },
          required: ['product_id']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'list_product_categories',
        description: 'Get a list of all available product categories.',
        parameters: {
          type: 'object',
          properties: {}
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_products_by_category',
        description: 'ONLY use this if you already called list_product_categories and know the EXACT category name. DO NOT guess category names like "laptops" or "phones". For general product questions, ALWAYS use browse_full_catalog instead.',
        parameters: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              description: 'The EXACT category name from list_product_categories (must match exactly)'
            },
            limit: {
              type: 'number',
              description: 'Maximum number of products to return (default: 20)',
              default: 20
            }
          },
          required: ['category']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_active_promotions',
        description: 'Get all currently active promotions, sales, discounts, and special offers. Use this when customers ask about promotions, discounts, sales, deals, or special offers.',
        parameters: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Maximum number of promotions to return (default: 10)',
              default: 10
            }
          }
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'validate_promo_code',
        description: 'Check if a promo code is valid and get its discount details. Use this when a customer asks about a specific promo code.',
        parameters: {
          type: 'object',
          properties: {
            promo_code: {
              type: 'string',
              description: 'The promo code to validate'
            }
          },
          required: ['promo_code']
        }
      }
    }
  ]
}

/**
 * Call OpenAI with function calling support
 */
async function callOpenAIWithTools(
  messages: any[],
  avatar: any,
  model: string,
  openaiApiKey: string,
  tools: any[],
  supabase: SupabaseClient,
  avatarId: string
): Promise<{ finalResponse: string; toolCallsExecuted: number }> {
  let toolCallsExecuted = 0

  // Initial call to OpenAI
  let openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiApiKey}`
    },
    body: JSON.stringify({
      model: avatar.fine_tuned_model_id || model,
      messages,
      tools,
      tool_choice: 'auto',
      max_tokens: model.includes('gpt-4o-mini') ? 2000 : 1000,
      temperature: 0.7
    })
  })

  if (!openaiResponse.ok) {
    const errorData = await openaiResponse.json()
    throw new Error(errorData.error?.message || 'OpenAI API error')
  }

  let openaiData = await openaiResponse.json()
  let assistantMessage = openaiData.choices[0].message

  // Handle function calls (iterative loop)
  while (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
    // Add assistant message with tool calls to conversation
    messages.push(assistantMessage)

    // Execute each tool call
    for (const toolCall of assistantMessage.tool_calls) {
      const functionName = toolCall.function.name
      const functionArgs = JSON.parse(toolCall.function.arguments)

      let functionResult: any = {}

      try {
        // Execute the appropriate function
        functionResult = await executeTool(
          functionName,
          functionArgs,
          supabase,
          avatarId,
          avatar // Pass avatar for price_visible check
        )
        toolCallsExecuted++
      } catch (error: any) {
        functionResult = {
          success: false,
          error: error.message
        }
      }

      // Add function result to messages
      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(functionResult)
      })
    }

    // Call OpenAI again with function results
    openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: avatar.fine_tuned_model_id || model,
        messages,
        tools,
        tool_choice: 'auto',
        max_tokens: model.includes('gpt-4o-mini') ? 2000 : 1000,
        temperature: 0.7
      })
    })

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.json()
      throw new Error(errorData.error?.message || 'OpenAI API error')
    }

    openaiData = await openaiResponse.json()
    assistantMessage = openaiData.choices[0].message
  }

  return {
    finalResponse: assistantMessage.content,
    toolCallsExecuted
  }
}

/**
 * Helper function to get active promotions for a chatbot
 */
async function getActivePromotionsForChatbot(
  supabase: SupabaseClient,
  avatarId: string
): Promise<any[]> {
  const { data: promotions } = await supabase
    .from('chatbot_promotions')
    .select('*')
    .eq('chatbot_id', avatarId)
    .eq('is_active', true)

  const now = new Date()
  return (promotions || []).filter((promo: any) => {
    const startDate = promo.start_date ? new Date(promo.start_date) : null
    const endDate = promo.end_date ? new Date(promo.end_date) : null
    const afterStart = !startDate || now >= startDate
    const beforeEnd = !endDate || now <= endDate
    const notMaxedOut = !promo.max_uses || promo.current_uses < promo.max_uses
    return afterStart && beforeEnd && notMaxedOut
  })
}

/**
 * Helper function to apply promotions to products and handle price visibility
 */
async function processProductsWithPromotions(
  products: any[],
  priceVisible: boolean,
  supabase: SupabaseClient,
  avatarId: string
): Promise<any[]> {
  if (!products || products.length === 0) return []

  // Get active promotions to apply to products
  const activePromotions = await getActivePromotionsForChatbot(supabase, avatarId)

  return products.map((product: any) => {
    // Find applicable promotions for this product
    const applicablePromotions = activePromotions.filter((promo: any) => {
      if (promo.applies_to === 'all') return true
      if (promo.applies_to === 'category' && promo.applies_to_categories?.includes(product.category)) return true
      if (promo.applies_to === 'products' && promo.applies_to_product_ids?.includes(product.id)) return true
      return false
    })

    // Calculate the best discount (highest discount)
    let discountedPrice = product.unit_price
    let appliedPromotion = null

    for (const promo of applicablePromotions) {
      let newPrice = product.unit_price
      if (promo.discount_type === 'percentage') {
        newPrice = product.unit_price * (1 - promo.discount_value / 100)
      } else if (promo.discount_type === 'fixed') {
        newPrice = Math.max(0, product.unit_price - promo.discount_value)
      }

      if (newPrice < discountedPrice) {
        discountedPrice = newPrice
        appliedPromotion = {
          title: promo.title,
          promo_code: promo.promo_code,
          discount: promo.discount_type === 'percentage'
            ? `${promo.discount_value}% OFF`
            : `RM${promo.discount_value} OFF`
        }
      }
    }

    // Build the processed product object
    const processedProduct: any = {
      id: product.id,
      product_name: product.product_name,
      description: product.description,
      category: product.category,
      sku: product.sku,
      in_stock: product.in_stock,
      stock_quantity: product.stock_quantity,
      // Use primary_image_url or first image from images array
      has_image: !!(product.primary_image_url || (product.images && product.images.length > 0)),
      // CRITICAL: This is the exact text to include in response to display the image
      DISPLAY_IMAGE: (product.primary_image_url || product.images?.[0])
        ? `[IMAGE:${product.primary_image_url || product.images[0]}:${product.product_name}]`
        : null
    }

    // Only include price information if prices are visible
    if (priceVisible) {
      processedProduct.original_price = product.unit_price
      if (appliedPromotion && discountedPrice < product.unit_price) {
        processedProduct.discounted_price = Math.round(discountedPrice * 100) / 100
        processedProduct.current_price = processedProduct.discounted_price
        processedProduct.applied_promotion = appliedPromotion
        processedProduct.has_discount = true
      } else {
        processedProduct.current_price = product.unit_price
        processedProduct.has_discount = false
      }
    } else {
      processedProduct.price_hidden = true
      processedProduct.price_message = "Contact us for pricing"
    }

    return processedProduct
  })
}

/**
 * Execute a specific tool/function
 */
async function executeTool(
  functionName: string,
  functionArgs: any,
  supabase: SupabaseClient,
  avatarId: string,
  avatar: any
): Promise<any> {
  const priceVisible = avatar.price_visible !== false

  if (functionName === 'browse_full_catalog') {
    // Get ALL products from the catalog
    const { include_out_of_stock = false } = functionArgs

    let query = supabase
      .from('chatbot_products')
      .select('*')
      .eq('chatbot_id', avatarId)
      .order('category', { ascending: true })
      .order('product_name', { ascending: true })

    // Optionally filter out of stock items
    if (!include_out_of_stock) {
      query = query.eq('in_stock', true)
    }

    const { data: products } = await query

    // Process ALL products with promotions and price visibility
    const processedProducts = await processProductsWithPromotions(products || [], priceVisible, supabase, avatarId)

    // Group products by category for easier AI understanding
    const productsByCategory: Record<string, any[]> = {}
    processedProducts.forEach((p: any) => {
      const cat = p.category || 'Uncategorized'
      if (!productsByCategory[cat]) productsByCategory[cat] = []
      productsByCategory[cat].push(p)
    })

    // Build image instructions for products with images (limit to first 5)
    const productsWithImages = processedProducts.filter((p: any) => p.DISPLAY_IMAGE).slice(0, 5)
    const imageInstructions = productsWithImages.length > 0
      ? `ACTION REQUIRED: To show product images, you MUST include these EXACT strings in your response:\n${productsWithImages.map((p: any) => `- For ${p.product_name}: ${p.DISPLAY_IMAGE}`).join('\n')}`
      : null

    return {
      success: true,
      total_products: processedProducts.length,
      products_by_category: productsByCategory,
      all_products: processedProducts,
      categories: Object.keys(productsByCategory),
      price_visible: priceVisible,
      HOW_TO_SHOW_IMAGES: imageInstructions,
      note: 'This is the COMPLETE catalog. Use your intelligence to recommend relevant products based on what the customer is asking for.'
    }
  } else if (functionName === 'search_products') {
    const { query, limit = 10 } = functionArgs
    const { data: products } = await supabase
      .from('chatbot_products')
      .select('*')
      .eq('chatbot_id', avatarId)
      .or(`product_name.ilike.%${query}%,category.ilike.%${query}%,sku.ilike.%${query}%,description.ilike.%${query}%`)
      .order('created_at', { ascending: false })
      .limit(limit)

    // Process products with promotions and price visibility
    const processedProducts = await processProductsWithPromotions(products || [], priceVisible, supabase, avatarId)

    // Build explicit image display instructions for products with images
    const productsWithImages = processedProducts.filter((p: any) => p.DISPLAY_IMAGE)
    const imageInstructions = productsWithImages.length > 0
      ? `ACTION REQUIRED: To show product images, you MUST include these EXACT strings in your response:\n${productsWithImages.map((p: any) => `- For ${p.product_name}: ${p.DISPLAY_IMAGE}`).join('\n')}`
      : null

    return {
      success: true,
      products: processedProducts,
      count: processedProducts.length,
      price_visible: priceVisible,
      HOW_TO_SHOW_IMAGES: imageInstructions
    }
  } else if (functionName === 'get_product_by_id') {
    const { product_id } = functionArgs
    const { data: product } = await supabase
      .from('chatbot_products')
      .select('*')
      .eq('id', product_id)
      .eq('chatbot_id', avatarId)
      .single()

    // Process the single product
    const processedProducts = product ? await processProductsWithPromotions([product], priceVisible, supabase, avatarId) : []

    const productData = processedProducts[0] || null
    return {
      success: !!product,
      product: productData,
      price_visible: priceVisible,
      HOW_TO_SHOW_IMAGE: productData?.DISPLAY_IMAGE
        ? `ACTION REQUIRED: To show this product's image, include this EXACT string in your response: ${productData.DISPLAY_IMAGE}`
        : null
    }
  } else if (functionName === 'list_product_categories') {
    const { data: products } = await supabase
      .from('chatbot_products')
      .select('category')
      .eq('chatbot_id', avatarId)
      .not('category', 'is', null)

    const categories = [...new Set(products?.map(p => p.category).filter(Boolean))]
    return {
      success: true,
      categories,
      count: categories.length
    }
  } else if (functionName === 'get_products_by_category') {
    const { category, limit = 20 } = functionArgs
    const { data: products } = await supabase
      .from('chatbot_products')
      .select('*')
      .eq('chatbot_id', avatarId)
      .eq('category', category)
      .order('created_at', { ascending: false })
      .limit(limit)

    // Process products with promotions and price visibility
    const processedProducts = await processProductsWithPromotions(products || [], priceVisible, supabase, avatarId)

    // Build explicit image display instructions for products with images
    const categoryProductsWithImages = processedProducts.filter((p: any) => p.DISPLAY_IMAGE)
    const categoryImageInstructions = categoryProductsWithImages.length > 0
      ? `ACTION REQUIRED: To show product images, you MUST include these EXACT strings in your response:\n${categoryProductsWithImages.map((p: any) => `- For ${p.product_name}: ${p.DISPLAY_IMAGE}`).join('\n')}`
      : null

    return {
      success: true,
      products: processedProducts,
      count: processedProducts.length,
      price_visible: priceVisible,
      HOW_TO_SHOW_IMAGES: categoryImageInstructions
    }
  } else if (functionName === 'get_active_promotions') {
    const { limit = 10 } = functionArgs
    const today = new Date().toISOString().split('T')[0]

    // Get active promotions within date range
    const { data: promotions } = await supabase
      .from('chatbot_promotions')
      .select('*')
      .eq('chatbot_id', avatarId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(limit)

    // Filter by valid date range
    const activePromotions = (promotions || []).filter(promo => {
      const now = new Date()
      const startDate = promo.start_date ? new Date(promo.start_date) : null
      const endDate = promo.end_date ? new Date(promo.end_date) : null

      const afterStart = !startDate || now >= startDate
      const beforeEnd = !endDate || now <= endDate
      const notMaxedOut = !promo.max_uses || promo.current_uses < promo.max_uses

      return afterStart && beforeEnd && notMaxedOut
    })

    // Format promotions for AI response
    const formattedPromotions = activePromotions.map(promo => ({
      title: promo.title,
      description: promo.description,
      promo_code: promo.promo_code,
      discount: promo.discount_type === 'percentage'
        ? `${promo.discount_value}% OFF`
        : promo.discount_value ? `RM${promo.discount_value} OFF` : null,
      discount_type: promo.discount_type,
      discount_value: promo.discount_value,
      valid_from: promo.start_date,
      valid_until: promo.end_date,
      terms: promo.terms_and_conditions,
      has_banner: !!promo.banner_image_url,
      DISPLAY_BANNER: promo.banner_image_url ? `[IMAGE:${promo.banner_image_url}:${promo.title}]` : null
    }))

    // Build explicit image display instructions for promotions with banners
    const promosWithBanners = formattedPromotions.filter((p: any) => p.DISPLAY_BANNER)
    const promoImageInstructions = promosWithBanners.length > 0
      ? `ACTION REQUIRED: To show promotion banners, you MUST include these EXACT strings in your response:\n${promosWithBanners.map((p: any) => `- For "${p.title}": ${p.DISPLAY_BANNER}`).join('\n')}`
      : null

    return {
      success: true,
      promotions: formattedPromotions,
      count: formattedPromotions.length,
      message: formattedPromotions.length > 0
        ? `Found ${formattedPromotions.length} active promotion(s).`
        : 'No active promotions at the moment',
      HOW_TO_SHOW_BANNERS: promoImageInstructions
    }
  } else if (functionName === 'validate_promo_code') {
    const { promo_code } = functionArgs
    const today = new Date().toISOString().split('T')[0]

    const { data: promo } = await supabase
      .from('chatbot_promotions')
      .select('*')
      .eq('chatbot_id', avatarId)
      .ilike('promo_code', promo_code)
      .eq('is_active', true)
      .single()

    if (!promo) {
      return {
        success: false,
        valid: false,
        message: `Promo code "${promo_code}" is not valid or does not exist`
      }
    }

    // Check date validity
    const now = new Date()
    const startDate = promo.start_date ? new Date(promo.start_date) : null
    const endDate = promo.end_date ? new Date(promo.end_date) : null

    if (startDate && now < startDate) {
      return {
        success: true,
        valid: false,
        message: `Promo code "${promo_code}" is not active yet. It starts on ${promo.start_date}`,
        promotion: { title: promo.title, start_date: promo.start_date }
      }
    }

    if (endDate && now > endDate) {
      return {
        success: true,
        valid: false,
        message: `Promo code "${promo_code}" has expired on ${promo.end_date}`,
        promotion: { title: promo.title, end_date: promo.end_date }
      }
    }

    // Check usage limit
    if (promo.max_uses && promo.current_uses >= promo.max_uses) {
      return {
        success: true,
        valid: false,
        message: `Promo code "${promo_code}" has reached its maximum usage limit`,
        promotion: { title: promo.title }
      }
    }

    // Promo is valid!
    return {
      success: true,
      valid: true,
      message: `Promo code "${promo_code}" is valid!`,
      promotion: {
        title: promo.title,
        description: promo.description,
        discount: promo.discount_type === 'percentage'
          ? `${promo.discount_value}% OFF`
          : `RM${promo.discount_value} OFF`,
        discount_type: promo.discount_type,
        discount_value: promo.discount_value,
        valid_until: promo.end_date,
        terms: promo.terms_and_conditions
      }
    }
  }

  throw new Error(`Unknown function: ${functionName}`)
}
