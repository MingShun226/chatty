/**
 * WhatsApp Get OAuth URL
 *
 * Returns the OAuth URL for WhatsApp connection.
 * This keeps META_APP_ID secret (backend only).
 *
 * For SaaS platforms:
 * - Platform owner creates ONE Meta app
 * - All users connect through this app using Embedded Signup
 * - Users don't need to create their own Meta apps
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Meta app configuration (from secrets)
const META_APP_ID = Deno.env.get('META_APP_ID') || ''
const REDIRECT_URI = Deno.env.get('WHATSAPP_OAUTH_REDIRECT_URI') || ''

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    )

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser()

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get chatbot ID from request
    const { chatbotId } = await req.json()

    if (!chatbotId) {
      return new Response(
        JSON.stringify({ error: 'Missing chatbotId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify user owns this chatbot
    const { data: chatbot, error: chatbotError } = await supabaseClient
      .from('avatars')
      .select('id, user_id')
      .eq('id', chatbotId)
      .single()

    if (chatbotError || !chatbot || chatbot.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Chatbot not found or access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check Meta app is configured
    if (!META_APP_ID || !REDIRECT_URI) {
      return new Response(
        JSON.stringify({
          error: 'WhatsApp integration not configured. Please contact support.',
          configured: false
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Build OAuth state (userId + chatbotId)
    const state = btoa(JSON.stringify({
      userId: user.id,
      chatbotId: chatbotId,
      timestamp: Date.now()
    }))

    // Build WhatsApp Embedded Signup URL
    // This is the proper SaaS flow for WhatsApp Business API
    const oauthUrl = new URL('https://www.facebook.com/v21.0/dialog/oauth')

    // Required parameters
    oauthUrl.searchParams.set('client_id', META_APP_ID)
    oauthUrl.searchParams.set('redirect_uri', REDIRECT_URI)
    oauthUrl.searchParams.set('state', state)
    oauthUrl.searchParams.set('response_type', 'code')

    // Critical: Request the right scopes for WhatsApp Business
    oauthUrl.searchParams.set('scope', [
      'whatsapp_business_management',
      'whatsapp_business_messaging',
      'business_management'
    ].join(','))

    // IMPORTANT: The 'extras' parameter enables WhatsApp Embedded Signup
    // This shows users the WhatsApp Business setup wizard
    const extras = {
      feature: 'whatsapp_embedded_signup',
      setup: {}
    }

    oauthUrl.searchParams.set('extras', JSON.stringify(extras))

    // Display as page (not popup)
    oauthUrl.searchParams.set('display', 'page')

    return new Response(
      JSON.stringify({
        oauthUrl: oauthUrl.toString(),
        configured: true
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error: any) {
    console.error('Error generating OAuth URL:', error)
    return new Response(
      JSON.stringify({
        error: error.message || 'Internal server error',
        configured: false
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
