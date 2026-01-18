// Supabase Edge Function: Get Chatbot Configuration
// This function returns all configuration needed by n8n workflow
// Endpoint: GET /get-chatbot-config?chatbot_id={id}
//
// Returns:
// - Chatbot details (name, system_prompt, hidden_rules, personality, etc.)
// - API keys (OpenAI from admin_assigned_api_keys)
// - WhatsApp settings
// - Content summary (products count, promotions count, knowledge count)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
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

    // Verify API key
    const { data: keyData, error: keyError } = await supabase
      .rpc('verify_platform_api_key', { p_api_key: apiKey })
      .single()

    if (keyError || !keyData || !keyData.is_valid) {
      return new Response(
        JSON.stringify({ error: 'Invalid or inactive API key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse query parameters
    const url = new URL(req.url)
    const chatbotId = url.searchParams.get('chatbot_id')

    if (!chatbotId) {
      return new Response(
        JSON.stringify({ error: 'Missing chatbot_id query parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if API key is restricted to specific avatar/chatbot
    if (keyData.avatar_id && keyData.avatar_id !== chatbotId) {
      return new Response(
        JSON.stringify({ error: 'API key does not have access to this chatbot' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userId = keyData.user_id

    // Fetch chatbot details
    const { data: chatbot, error: chatbotError } = await supabase
      .from('avatars')
      .select(`
        id,
        name,
        description,
        company_name,
        industry,
        business_context,
        system_prompt,
        hidden_rules,
        personality_traits,
        compliance_rules,
        response_guidelines,
        supported_languages,
        default_language,
        primary_language,
        secondary_languages,
        activation_status,
        workflow_type,
        n8n_webhook_url,
        n8n_enabled,
        status,
        created_at
      `)
      .eq('id', chatbotId)
      .eq('user_id', userId)
      .single()

    if (chatbotError || !chatbot) {
      return new Response(
        JSON.stringify({ error: 'Chatbot not found or access denied' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if chatbot is activated
    if (chatbot.activation_status !== 'active') {
      return new Response(
        JSON.stringify({
          error: 'Chatbot is not activated',
          activation_status: chatbot.activation_status,
          message: chatbot.activation_status === 'pending'
            ? 'Chatbot is pending admin activation'
            : 'Chatbot has been suspended'
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch admin-assigned API keys for this user
    const { data: apiKeys } = await supabase
      .from('admin_assigned_api_keys')
      .select('provider, api_key')
      .eq('user_id', userId)
      .eq('is_active', true)

    // Build API keys object
    const apiKeysMap: Record<string, string> = {}
    for (const key of (apiKeys || [])) {
      apiKeysMap[key.provider] = key.api_key
    }

    // Fetch WhatsApp settings
    const { data: whatsappSettings } = await supabase
      .from('avatar_whatsapp_settings')
      .select('*')
      .eq('avatar_id', chatbotId)
      .single()

    // Fetch content counts in parallel
    const [productsCount, promotionsCount, knowledgeCount, promptVersion] = await Promise.all([
      // Products count
      supabase
        .from('chatbot_products')
        .select('id', { count: 'exact', head: true })
        .eq('chatbot_id', chatbotId)
        .eq('is_active', true),

      // Active promotions count
      supabase
        .from('chatbot_promotions')
        .select('id', { count: 'exact', head: true })
        .eq('chatbot_id', chatbotId)
        .eq('is_active', true),

      // Knowledge files count
      supabase
        .from('avatar_knowledge_files')
        .select('id', { count: 'exact', head: true })
        .eq('avatar_id', chatbotId)
        .eq('is_linked', true),

      // Active prompt version
      supabase
        .from('prompt_versions')
        .select('version_number, version_name, system_prompt')
        .eq('avatar_id', chatbotId)
        .eq('is_active', true)
        .single()
    ])

    // Build the response
    const config = {
      chatbot: {
        id: chatbot.id,
        name: chatbot.name,
        description: chatbot.description,
        company_name: chatbot.company_name,
        industry: chatbot.industry,
        business_context: chatbot.business_context,
        system_prompt: promptVersion.data?.system_prompt || chatbot.system_prompt,
        hidden_rules: chatbot.hidden_rules,
        personality_traits: chatbot.personality_traits,
        compliance_rules: chatbot.compliance_rules,
        response_guidelines: chatbot.response_guidelines,
        languages: {
          supported: chatbot.supported_languages || [chatbot.primary_language || 'en'],
          default: chatbot.default_language || chatbot.primary_language || 'en',
          secondary: chatbot.secondary_languages || []
        },
        activation_status: chatbot.activation_status,
        workflow_type: chatbot.workflow_type
      },
      api_keys: {
        openai: apiKeysMap['openai'] || null,
        has_openai: !!apiKeysMap['openai']
      },
      whatsapp_settings: whatsappSettings ? {
        message_delimiter: whatsappSettings.message_delimiter || '---',
        typing_speed_wpm: whatsappSettings.typing_speed_wpm || 150,
        batch_timeout_ms: whatsappSettings.batch_timeout_ms || 5000,
        enable_images: whatsappSettings.enable_images !== false,
        enable_audio: whatsappSettings.enable_audio !== false,
        enable_documents: whatsappSettings.enable_documents !== false,
        welcome_message: whatsappSettings.welcome_message || null,
        away_message: whatsappSettings.away_message || null,
        business_hours: whatsappSettings.business_hours || null
      } : {
        message_delimiter: '---',
        typing_speed_wpm: 150,
        batch_timeout_ms: 5000,
        enable_images: true,
        enable_audio: true,
        enable_documents: true
      },
      content: {
        products_count: productsCount.count || 0,
        promotions_count: promotionsCount.count || 0,
        knowledge_files_count: knowledgeCount.count || 0,
        has_products: (productsCount.count || 0) > 0,
        has_promotions: (promotionsCount.count || 0) > 0,
        has_knowledge: (knowledgeCount.count || 0) > 0
      },
      prompt_version: promptVersion.data ? {
        version: promptVersion.data.version_number,
        name: promptVersion.data.version_name
      } : null,
      endpoints: {
        chatbot_data: `${supabaseUrl}/functions/v1/chatbot-data`,
        chat_completions: `${supabaseUrl}/functions/v1/chat-completions`,
        analyze_image: `${supabaseUrl}/functions/v1/analyze-image`,
        generate_embedding: `${supabaseUrl}/functions/v1/generate-embedding`
      }
    }

    // Log the request
    await supabase.from('api_request_logs').insert({
      api_key_id: keyData.key_id,
      user_id: userId,
      endpoint: '/get-chatbot-config',
      method: 'GET',
      status_code: 200
    })

    // Update API key usage
    await supabase.rpc('increment_api_key_usage', {
      p_key_id: keyData.key_id
    })

    return new Response(
      JSON.stringify({
        success: true,
        ...config
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error: any) {
    console.error('Error in get-chatbot-config function:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
