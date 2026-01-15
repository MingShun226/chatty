// Supabase Edge Function for Avatar Chat API
// Endpoint: POST /avatar-chat
// This allows n8n and other services to send messages to avatars

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
}

interface ChatRequest {
  avatar_id: string
  message: string
  message_type?: string  // 'text', 'image', 'audio', 'video', 'document', etc.
  media?: {
    type: string
    mime_type: string
    url?: string      // Public URL from Supabase Storage
    caption?: string
  } | null
  conversation_history?: Array<{
    role: 'user' | 'assistant' | 'system'
    content: string
  }>
  model?: string
  user_identifier?: string  // WhatsApp number or other identifier
  prompt_version_id?: string  // Optional: test specific prompt version
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get API key from header
    const apiKey = req.headers.get('x-api-key')
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Missing API key. Include x-api-key header.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    let userId: string
    let keyData: any = null

    // Handle test mode authentication
    if (apiKey === 'test-mode') {
      // For test mode, use the authorization header to get the user
      const authHeader = req.headers.get('authorization')
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: 'Test mode requires authorization header' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Verify the session token
      const token = authHeader.replace('Bearer ', '')
      const { data: { user }, error: authError } = await supabase.auth.getUser(token)

      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: 'Invalid session token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      userId = user.id
      // Set keyData for test mode (no avatar_id restriction)
      keyData = {
        user_id: userId,
        avatar_id: null,
        scopes: ['chat'],
        key_id: 'test-mode'
      }
    } else {
      // Verify API key and get permissions
      const { data: verifiedKeyData, error: keyError } = await supabase
        .rpc('verify_platform_api_key', { p_api_key: apiKey })
        .single()

      if (keyError || !verifiedKeyData || !verifiedKeyData.is_valid) {
        return new Response(
          JSON.stringify({ error: 'Invalid or inactive API key' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Check if 'chat' scope is granted
      if (!verifiedKeyData.scopes.includes('chat')) {
        return new Response(
          JSON.stringify({ error: 'API key does not have chat permission' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      keyData = verifiedKeyData
      userId = keyData.user_id
    }

    // Parse request body
    const requestBody: ChatRequest = await req.json()
    const {
      avatar_id,
      message,
      message_type = 'text',
      media = null,
      conversation_history = [],
      model = 'gpt-3.5-turbo',
      user_identifier,
      prompt_version_id
    } = requestBody

    if (!avatar_id || !message) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: avatar_id and message' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if API key is restricted to specific avatar
    if (keyData.avatar_id && keyData.avatar_id !== avatar_id) {
      return new Response(
        JSON.stringify({ error: 'API key does not have access to this avatar' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get avatar configuration
    const { data: avatar, error: avatarError } = await supabase
      .from('avatars')
      .select('*')
      .eq('id', avatar_id)
      .eq('user_id', userId)
      .single()

    if (avatarError || !avatar) {
      return new Response(
        JSON.stringify({ error: 'Avatar not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get prompt version - use specific version if provided, otherwise active version
    let promptVersionQuery = supabase
      .from('avatar_prompt_versions')
      .select('*')
      .eq('avatar_id', avatar_id)
      .eq('user_id', userId)

    if (prompt_version_id) {
      // Use specific version for testing
      promptVersionQuery = promptVersionQuery.eq('id', prompt_version_id)
    } else {
      // Use active version for production
      promptVersionQuery = promptVersionQuery.eq('is_active', true)
    }

    const { data: promptVersion } = await promptVersionQuery
      .order('version_number', { ascending: false })
      .limit(1)
      .single()

    // Get knowledge base (RAG chunks)
    const { data: ragChunks } = await supabase
      .rpc('search_knowledge_chunks', {
        p_user_id: userId,
        p_avatar_id: avatar_id,
        p_query: message,
        p_limit: 5,
        p_threshold: 0.7
      })

    // Get recent memories
    const { data: memories } = await supabase
      .from('avatar_memories')
      .select(`
        *,
        memory_images (*)
      `)
      .eq('avatar_id', avatar_id)
      .eq('user_id', userId)
      .order('memory_date', { ascending: false })
      .limit(10)

    // Build comprehensive system prompt for business chatbot
    let systemPrompt = `You are ${avatar.name}, an AI chatbot.`

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

    systemPrompt += `\n\nUser's current question: "${message}"

**CRITICAL - YOU MUST USE TOOLS:**
You have access to product and promotion databases. You MUST use the provided tools to get accurate information.

**MANDATORY TOOL USAGE:**
1. General product questions ("do you have phones?", "what do you sell?", "show me products", "looking for X") → MUST call browse_full_catalog FIRST
   - This gives you the COMPLETE catalog so you can intelligently recommend products
   - Example: User asks "do you have phones?" → browse_full_catalog → you see "iPhone 15 Pro Max" → recommend it
2. Only use search_products if you already know the EXACT product name or SKU
3. Promotion questions (discounts, sales, deals, offers, promo codes, 优惠, 折扣, 促销) → MUST call get_active_promotions
4. Promo code validation → MUST call validate_promo_code

**SMART PRODUCT MATCHING:**
When you have the full catalog from browse_full_catalog:
- "phones" or "mobile" → Look for products with "Phone", "iPhone", "Samsung", etc.
- "laptops" or "computers" → Look for products with "Laptop", "MacBook", "Notebook", etc.
- Use YOUR intelligence to match user intent with products, not just keyword matching

**NEVER do these without calling tools first:**
- Never describe products from memory - ALWAYS browse catalog first
- Never make up prices, stock status, or product details
- Never guess promotions - ALWAYS call get_active_promotions${avatar.price_visible === false ? '\n- NEVER mention product prices - prices are hidden for this business' : ''}

After getting tool results, respond naturally based on the data returned.`

    // Get OpenAI API key (case-insensitive search for service name)
    const { data: apiKeyData } = await supabase
      .from('user_api_keys')
      .select('api_key_encrypted')
      .eq('user_id', userId)
      .ilike('service', 'openai')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!apiKeyData) {
      return new Response(
        JSON.stringify({ error: 'No OpenAI API key found for user' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Decrypt API key (simple base64 decode - match your encryption)
    const openaiApiKey = atob(apiKeyData.api_key_encrypted)

    // Define tools/functions the AI can call
    const tools = [
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
          description: 'Get all currently active promotions, sales, discounts, and special offers. ALWAYS use this when customers ask about promotions, discounts, sales, deals, offers, 优惠, 折扣, or 促销.',
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

    // Prepare user message content (handle media types)
    let userMessageContent = message
    if (message_type === 'image' && media) {
      // User sent an image - include context with URL
      const imageInfo = media.url ? ` (Image URL: ${media.url})` : ''
      userMessageContent = media.caption
        ? `[User sent an image with caption: "${media.caption}"]${imageInfo}`
        : `[User sent an image]${imageInfo} ${message}`
      console.log(`Processing image message: ${userMessageContent}`)
    } else if (message_type === 'audio') {
      userMessageContent = `[User sent a voice message] ${message}`
    } else if (message_type === 'video') {
      const videoUrl = media?.url ? ` (Video URL: ${media.url})` : ''
      userMessageContent = `[User sent a video${media?.caption ? ` with caption: "${media.caption}"` : ''}]${videoUrl} ${message}`
    } else if (message_type === 'document') {
      userMessageContent = `[User sent a document: ${message}]`
    } else if (message_type === 'location') {
      userMessageContent = `[User shared a location: ${message}]`
    } else if (message_type === 'sticker') {
      userMessageContent = `[User sent a sticker]`
    }

    // ============================================
    // SYSTEM-LEVEL PRICE QUERY DETECTION
    // ============================================
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

        // Log the request
        await supabase.from('api_request_logs').insert({
          api_key_id: keyData.key_id,
          user_id: userId,
          endpoint: '/avatar-chat',
          method: 'POST',
          status_code: 200
        })

        // Return response immediately without calling OpenAI
        return new Response(
          JSON.stringify({
            success: true,
            avatar_id,
            message: priceHiddenResponse,
            metadata: {
              model: 'system-response',
              knowledge_chunks_used: 0,
              memories_accessed: 0,
              price_query_detected: true,
              escalated_to_human: true
            }
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }
    }

    // Prepare messages for OpenAI
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversation_history.slice(-30),
      { role: 'user', content: userMessageContent }
    ]

    // Call OpenAI API with function calling
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

    // Helper function to get active promotions for the chatbot
    const getActivePromotions = async () => {
      const { data: promotions } = await supabase
        .from('chatbot_promotions')
        .select('*')
        .eq('chatbot_id', avatar_id)
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

    // Helper function to apply promotions to products and handle price visibility
    const processProductsWithPromotions = async (products: any[], priceVisible: boolean) => {
      if (!products || products.length === 0) return []

      // Get active promotions to apply to products
      const activePromotions = await getActivePromotions()

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
            processedProduct.discounted_price = Math.round(discountedPrice * 100) / 100 // Round to 2 decimal places
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

    // Collect images from tool calls for automatic injection
    const collectedImages: Array<{ name: string; imageTag: string }> = []

    // Track tool calls for debugging
    let toolCallsExecuted = 0
    const toolCallsLog: string[] = []
    let debugInfo: any = {}

    // Handle function calls
    while (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      // Add assistant message with tool calls to conversation
      messages.push(assistantMessage)

      // Execute each tool call
      for (const toolCall of assistantMessage.tool_calls) {
        const functionName = toolCall.function.name
        const functionArgs = JSON.parse(toolCall.function.arguments)

        // Track tool calls
        toolCallsExecuted++
        toolCallsLog.push(`${functionName}(${JSON.stringify(functionArgs)})`)

        let functionResult: any = {}

        try {
          // Execute the appropriate function
          if (functionName === 'browse_full_catalog') {
            // Get ALL products from the catalog
            const { include_out_of_stock = false } = functionArgs

            let query = supabase
              .from('chatbot_products')
              .select('*')
              .eq('chatbot_id', avatar_id)
              .order('category', { ascending: true })
              .order('product_name', { ascending: true })

            // Optionally filter out of stock items
            if (!include_out_of_stock) {
              query = query.eq('in_stock', true)
            }

            const { data: products, error: catalogError } = await query

            debugInfo = {
              tool: 'browse_full_catalog',
              chatbot_id: avatar_id,
              total_products: products?.length || 0,
              include_out_of_stock,
              catalog_error: catalogError?.message || null
            }

            // Process ALL products with promotions and price visibility
            const processedProducts = await processProductsWithPromotions(products || [], avatar.price_visible !== false)

            // Collect images for automatic injection (limit to first 5 to avoid too many)
            processedProducts.slice(0, 5).forEach((p: any) => {
              if (p.DISPLAY_IMAGE) {
                collectedImages.push({ name: p.product_name, imageTag: p.DISPLAY_IMAGE })
              }
            })

            // Group products by category for easier AI understanding
            const productsByCategory: Record<string, any[]> = {}
            processedProducts.forEach((p: any) => {
              const cat = p.category || 'Uncategorized'
              if (!productsByCategory[cat]) productsByCategory[cat] = []
              productsByCategory[cat].push(p)
            })

            functionResult = {
              success: true,
              total_products: processedProducts.length,
              products_by_category: productsByCategory,
              all_products: processedProducts,
              categories: Object.keys(productsByCategory),
              price_visible: avatar.price_visible !== false,
              note: 'This is the COMPLETE catalog. Use your intelligence to recommend relevant products based on what the customer is asking for.'
            }
          } else if (functionName === 'search_products') {
            const { query, limit = 10 } = functionArgs
            const { data: products, error: searchError } = await supabase
              .from('chatbot_products')
              .select('*')
              .eq('chatbot_id', avatar_id)
              .or(`product_name.ilike.%${query}%,category.ilike.%${query}%,sku.ilike.%${query}%,description.ilike.%${query}%`)
              .order('created_at', { ascending: false })
              .limit(limit)

            // Debug: track raw results - check both primary_image_url and images array
            const firstProduct = products?.[0]
            debugInfo = {
              search_query: query,
              chatbot_id: avatar_id,
              raw_products_count: products?.length || 0,
              raw_products_with_images: products?.filter((p: any) => p.primary_image_url || (p.images && p.images.length > 0)).length || 0,
              first_product_primary_image_url: firstProduct?.primary_image_url || null,
              first_product_images_array: firstProduct?.images || [],
              search_error: searchError?.message || null
            }

            // Process products with promotions and price visibility
            const processedProducts = await processProductsWithPromotions(products || [], avatar.price_visible !== false)

            // Collect images for automatic injection
            processedProducts.forEach((p: any) => {
              if (p.DISPLAY_IMAGE) {
                collectedImages.push({ name: p.product_name, imageTag: p.DISPLAY_IMAGE })
              }
            })

            functionResult = {
              success: true,
              products: processedProducts,
              count: processedProducts.length,
              price_visible: avatar.price_visible !== false
            }
          } else if (functionName === 'get_product_by_id') {
            const { product_id } = functionArgs
            const { data: product } = await supabase
              .from('chatbot_products')
              .select('*')
              .eq('id', product_id)
              .eq('chatbot_id', avatar_id)
              .single()

            // Process the single product
            const processedProducts = product ? await processProductsWithPromotions([product], avatar.price_visible !== false) : []

            const productData = processedProducts[0] || null

            // Collect image for automatic injection
            if (productData?.DISPLAY_IMAGE) {
              collectedImages.push({ name: productData.product_name, imageTag: productData.DISPLAY_IMAGE })
            }

            functionResult = {
              success: !!product,
              product: productData,
              price_visible: avatar.price_visible !== false
            }
          } else if (functionName === 'list_product_categories') {
            const { data: products } = await supabase
              .from('chatbot_products')
              .select('category')
              .eq('chatbot_id', avatar_id)
              .not('category', 'is', null)

            const categories = [...new Set(products?.map(p => p.category).filter(Boolean))]
            functionResult = {
              success: true,
              categories,
              count: categories.length
            }
          } else if (functionName === 'get_products_by_category') {
            const { category, limit = 20 } = functionArgs
            const { data: products } = await supabase
              .from('chatbot_products')
              .select('*')
              .eq('chatbot_id', avatar_id)
              .eq('category', category)
              .order('created_at', { ascending: false })
              .limit(limit)

            // Process products with promotions and price visibility
            const processedProducts = await processProductsWithPromotions(products || [], avatar.price_visible !== false)

            // Collect images for automatic injection
            processedProducts.forEach((p: any) => {
              if (p.DISPLAY_IMAGE) {
                collectedImages.push({ name: p.product_name, imageTag: p.DISPLAY_IMAGE })
              }
            })

            functionResult = {
              success: true,
              products: processedProducts,
              count: processedProducts.length,
              price_visible: avatar.price_visible !== false
            }
          } else if (functionName === 'get_active_promotions') {
            const { limit = 10 } = functionArgs

            // Get active promotions
            const { data: promotions } = await supabase
              .from('chatbot_promotions')
              .select('*')
              .eq('chatbot_id', avatar_id)
              .eq('is_active', true)
              .order('created_at', { ascending: false })
              .limit(limit)

            // Filter by valid date range
            const now = new Date()
            const activePromotions = (promotions || []).filter((promo: any) => {
              const startDate = promo.start_date ? new Date(promo.start_date) : null
              const endDate = promo.end_date ? new Date(promo.end_date) : null
              const afterStart = !startDate || now >= startDate
              const beforeEnd = !endDate || now <= endDate
              const notMaxedOut = !promo.max_uses || promo.current_uses < promo.max_uses
              return afterStart && beforeEnd && notMaxedOut
            })

            // Format promotions for AI response
            const formattedPromotions = activePromotions.map((promo: any) => ({
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

            // Collect promotion banners for automatic injection
            formattedPromotions.forEach((p: any) => {
              if (p.DISPLAY_BANNER) {
                collectedImages.push({ name: p.title, imageTag: p.DISPLAY_BANNER })
              }
            })

            functionResult = {
              success: true,
              promotions: formattedPromotions,
              count: formattedPromotions.length,
              message: formattedPromotions.length > 0
                ? `Found ${formattedPromotions.length} active promotion(s).`
                : 'No active promotions at the moment'
            }
          } else if (functionName === 'validate_promo_code') {
            const { promo_code } = functionArgs

            const { data: promo } = await supabase
              .from('chatbot_promotions')
              .select('*')
              .eq('chatbot_id', avatar_id)
              .ilike('promo_code', promo_code)
              .eq('is_active', true)
              .single()

            if (!promo) {
              functionResult = {
                success: false,
                valid: false,
                message: `Promo code "${promo_code}" is not valid or does not exist`
              }
            } else {
              const now = new Date()
              const startDate = promo.start_date ? new Date(promo.start_date) : null
              const endDate = promo.end_date ? new Date(promo.end_date) : null

              if (startDate && now < startDate) {
                functionResult = {
                  success: true,
                  valid: false,
                  message: `Promo code "${promo_code}" is not active yet. It starts on ${promo.start_date}`
                }
              } else if (endDate && now > endDate) {
                functionResult = {
                  success: true,
                  valid: false,
                  message: `Promo code "${promo_code}" has expired on ${promo.end_date}`
                }
              } else if (promo.max_uses && promo.current_uses >= promo.max_uses) {
                functionResult = {
                  success: true,
                  valid: false,
                  message: `Promo code "${promo_code}" has reached its maximum usage limit`
                }
              } else {
                functionResult = {
                  success: true,
                  valid: true,
                  message: `Promo code "${promo_code}" is valid!`,
                  promotion: {
                    title: promo.title,
                    description: promo.description,
                    discount: promo.discount_type === 'percentage'
                      ? `${promo.discount_value}% OFF`
                      : `RM${promo.discount_value} OFF`,
                    valid_until: promo.end_date,
                    terms: promo.terms_and_conditions
                  }
                }
              }
            }
          }
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

    let finalResponse = assistantMessage.content

    // ============================================
    // AUTOMATIC IMAGE INJECTION
    // ============================================
    // If products/promotions with images were fetched but AI didn't include them,
    // automatically append the images to the response
    if (collectedImages.length > 0) {
      // Check if any [IMAGE:...] tag already exists in the response
      const hasImageInResponse = finalResponse?.includes('[IMAGE:')

      if (!hasImageInResponse) {
        // AI didn't include images - automatically inject them
        // Only inject images for products/promotions mentioned in the response
        const imagesToInject: string[] = []

        for (const img of collectedImages) {
          // Check if this product/promotion name is mentioned in the response
          const nameLower = img.name.toLowerCase()
          const responseLower = (finalResponse || '').toLowerCase()

          if (responseLower.includes(nameLower) || collectedImages.length === 1) {
            // Product is mentioned OR only one product was fetched (likely the main topic)
            imagesToInject.push(img.imageTag)
          }
        }

        // Inject unique images (avoid duplicates)
        const uniqueImages = [...new Set(imagesToInject)]
        if (uniqueImages.length > 0) {
          // Append images at the end of the response
          finalResponse = (finalResponse || '') + '\n\n' + uniqueImages.join('\n')
        }
      }
    }

    // Log the request
    await supabase.from('api_request_logs').insert({
      api_key_id: keyData.key_id,
      user_id: userId,
      endpoint: '/avatar-chat',
      method: 'POST',
      status_code: 200
    })

    // Update API key usage
    await supabase.rpc('increment_api_key_usage', {
      p_key_id: keyData.key_id
    })

    // Return response
    return new Response(
      JSON.stringify({
        success: true,
        avatar_id,
        message: finalResponse,
        metadata: {
          model: avatar.fine_tuned_model_id || model,
          knowledge_chunks_used: ragChunks?.length || 0,
          memories_accessed: memories?.length || 0,
          tool_calls_executed: toolCallsExecuted,
          tool_calls_log: toolCallsLog,
          images_collected: collectedImages.length,
          debug: debugInfo
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error: any) {
    console.error('Error in avatar-chat function:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
