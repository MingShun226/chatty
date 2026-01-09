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
  conversation_history?: Array<{
    role: 'user' | 'assistant' | 'system'
    content: string
  }>
  model?: string
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
    const { avatar_id, message, conversation_history = [], model = 'gpt-3.5-turbo' } = requestBody

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

    // Get active prompt version
    const { data: promptVersion } = await supabase
      .from('avatar_prompt_versions')
      .select('*')
      .eq('avatar_id', avatar_id)
      .eq('user_id', userId)
      .eq('is_active', true)
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

    // Get OpenAI API key
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

    // Prepare messages for OpenAI
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversation_history.slice(-30),
      { role: 'user', content: message }
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

    // Handle function calls
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
          if (functionName === 'search_products') {
            const { query, limit = 10 } = functionArgs
            const { data: products } = await supabase
              .from('chatbot_products')
              .select('*')
              .eq('chatbot_id', avatar_id)
              .or(`product_name.ilike.%${query}%,category.ilike.%${query}%,sku.ilike.%${query}%,description.ilike.%${query}%`)
              .order('created_at', { ascending: false })
              .limit(limit)

            functionResult = {
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
              .eq('chatbot_id', avatar_id)
              .single()

            functionResult = {
              success: !!product,
              product: product || null
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

            functionResult = {
              success: true,
              products: products || [],
              count: products?.length || 0
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
              banner_image: promo.banner_image_url,
              // Include formatted image tag for AI to use directly
              image_tag: promo.banner_image_url ? `[IMAGE:${promo.banner_image_url}:${promo.title}]` : null
            }))

            functionResult = {
              success: true,
              promotions: formattedPromotions,
              count: formattedPromotions.length,
              message: formattedPromotions.length > 0
                ? `Found ${formattedPromotions.length} active promotion(s). IMPORTANT: If promotion has image_tag, include it in your response exactly as provided.`
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

    const finalResponse = assistantMessage.content

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
          memories_accessed: memories?.length || 0
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
