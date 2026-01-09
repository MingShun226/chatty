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
  // 6. GET OPENAI API KEY
  // =======================================
  const { data: apiKeyData } = await supabase
    .from('user_api_keys')
    .select('api_key_encrypted')
    .eq('user_id', userId)
    .eq('service', 'OpenAI')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!apiKeyData) {
    throw new Error('No OpenAI API key found for user')
  }

  // Decrypt API key (simple base64 decode)
  const openaiApiKey = atob(apiKeyData.api_key_encrypted)

  // =======================================
  // 7. DEFINE TOOLS (FUNCTION CALLING)
  // =======================================
  const tools = buildTools()

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

  systemPrompt += `\n\nUser's current question: "${message}"\n\nRespond professionally and helpfully. Use the available tools to access product information, search the knowledge base, or get any data you need from the database.

**CRITICAL - TOOL USAGE RULES:**
1. When customer asks about promotions, discounts, sales, deals, offers, promo codes, 优惠, 折扣, 促销 - ALWAYS call get_active_promotions first
2. When customer mentions a specific promo code - ALWAYS call validate_promo_code to verify it
3. When customer asks about products - call search_products or get_products_by_category
4. DO NOT guess or make up promotions. Only share promotions returned by the get_active_promotions tool

**IMPORTANT - FORMATTING IMAGES:**
When you have product images or promotion banners to share:
1. Include the image URL using this format: [IMAGE:url:caption]
2. For promotions with banner_image, always include: [IMAGE:banner_image_url:Promotion Title]
3. For products with images, include: [IMAGE:image_url:Product Name]
4. The image will be sent before your text message

Example response with promotion image:
"We have an exciting promotion for you!
[IMAGE:https://example.com/promo.jpg:Chinese New Year Sale]
Get 50% off on all items with code CNY2024! Valid until January 31st."`

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
        name: 'search_products',
        description: 'Search for products by name, category, SKU, or description. Returns matching products with all details including images.',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query - can be product name, category, SKU, or any keyword'
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
        description: 'Get all products in a specific category.',
        parameters: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              description: 'The category name'
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
          avatarId
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
 * Execute a specific tool/function
 */
async function executeTool(
  functionName: string,
  functionArgs: any,
  supabase: SupabaseClient,
  avatarId: string
): Promise<any> {
  if (functionName === 'search_products') {
    const { query, limit = 10 } = functionArgs
    const { data: products } = await supabase
      .from('chatbot_products')
      .select('*')
      .eq('chatbot_id', avatarId)
      .or(`product_name.ilike.%${query}%,category.ilike.%${query}%,sku.ilike.%${query}%,description.ilike.%${query}%`)
      .order('created_at', { ascending: false })
      .limit(limit)

    return {
      success: true,
      products: products || [],
      count: products?.length || 0
    }
  } else if (functionName === 'get_product_by_id') {
    const { product_id } = functionArgs
    const { data: product } = await supabase
      .from('chatbot_products')
      .select('*')
      .eq('id', product_id)
      .eq('chatbot_id', avatarId)
      .single()

    return {
      success: !!product,
      product: product || null
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

    return {
      success: true,
      products: products || [],
      count: products?.length || 0
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
      banner_image: promo.banner_image_url
    }))

    return {
      success: true,
      promotions: formattedPromotions,
      count: formattedPromotions.length,
      message: formattedPromotions.length > 0
        ? `Found ${formattedPromotions.length} active promotion(s)`
        : 'No active promotions at the moment'
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
