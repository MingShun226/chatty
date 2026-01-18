// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req: Request) => {
  // Handle CORS preflight immediately - before any other processing
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      status: 200,
      headers: corsHeaders
    })
  }

  try {
    // Only handle POST requests
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get the authorization token
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // @ts-ignore
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.7.1')
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify user authentication
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get request body
    const requestBody = await req.json()

    // Check if caller is an admin (for admin operations like generating prompts for users)
    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('id, role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    const isAdmin = !!adminUser

    // Determine which user's API key to use
    // If admin and forUserId is provided, use that user's key
    // Otherwise use the caller's key
    const targetUserId = (isAdmin && requestBody.forUserId) ? requestBody.forUserId : user.id

    // Remove forUserId from request body before sending to OpenAI (it's our custom field)
    const { forUserId, ...openaiRequestBody } = requestBody

    // First check for admin-assigned API key (platform-managed)
    let apiKey: string | null = null
    let keySource: 'admin' | 'user' | 'platform' = 'admin'

    // For admins, first try to use platform-level API key (admin's own assigned key)
    if (isAdmin) {
      const { data: platformKey } = await supabase
        .from('admin_assigned_api_keys')
        .select('api_key_encrypted')
        .eq('user_id', user.id) // Admin's own key
        .eq('service', 'openai')
        .eq('is_active', true)
        .maybeSingle()

      if (platformKey?.api_key_encrypted) {
        try {
          apiKey = atob(platformKey.api_key_encrypted)
          keySource = 'platform'
        } catch (e) {
          console.error('Failed to decrypt platform API key')
        }
      }
    }

    // If no platform key, check for target user's admin-assigned key
    if (!apiKey) {
      const { data: adminKey } = await supabase
        .from('admin_assigned_api_keys')
        .select('api_key_encrypted')
        .eq('user_id', targetUserId)
        .eq('service', 'openai')
        .eq('is_active', true)
        .maybeSingle()

      if (adminKey?.api_key_encrypted) {
        try {
          apiKey = atob(adminKey.api_key_encrypted)
          keySource = 'admin'
        } catch (e) {
          console.error('Failed to decrypt admin-assigned API key')
        }
      }
    }

    // Fall back to target user's own key if no admin-assigned key
    if (!apiKey) {
      keySource = 'user'
      const { data: userKey } = await supabase
        .from('user_api_keys')
        .select('api_key_encrypted')
        .eq('user_id', targetUserId)
        .eq('service', 'openai')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (userKey?.api_key_encrypted) {
        try {
          apiKey = atob(userKey.api_key_encrypted)
        } catch (e) {
          console.error('Failed to decrypt user API key')
        }
      }
    }

    if (!apiKey) {
      const errorMsg = isAdmin
        ? 'No OpenAI API key configured. Please assign an API key to yourself (Admin) or to the target user in Admin > Users > User Details > API Keys.'
        : 'No OpenAI API key configured. Please contact your administrator.'
      return new Response(
        JSON.stringify({ error: errorMsg }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Update last_used_at for the appropriate key (async, don't wait)
    if (keySource === 'admin') {
      supabase
        .from('admin_assigned_api_keys')
        .update({ updated_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('service', 'openai')
        .eq('is_active', true)
        .then(() => {})
        .catch(() => {})
    } else {
      supabase
        .from('user_api_keys')
        .update({ last_used_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('service', 'openai')
        .eq('status', 'active')
        .then(() => {})
        .catch(() => {})
    }

    // Proxy request to OpenAI
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(openaiRequestBody)
    })

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text()
      let errorData: any = {}
      try {
        errorData = JSON.parse(errorText)
      } catch (e) {
        errorData = { error: { message: errorText } }
      }

      return new Response(
        JSON.stringify({
          error: errorData.error?.message || `OpenAI API error: ${openaiResponse.status}`
        }),
        {
          status: openaiResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const data = await openaiResponse.json()

    return new Response(
      JSON.stringify(data),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({
        error: error?.message || 'Internal server error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
