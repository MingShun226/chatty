// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get authorization
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get request body
    const { text, model = 'text-embedding-ada-002' } = await req.json()

    if (!text) {
      return new Response(
        JSON.stringify({ error: 'Text is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get OpenAI API key (admin-assigned > user's key)
    let apiKey: string | null = null

    // First check for admin-assigned API key
    const { data: adminKey } = await supabase
      .from('admin_assigned_api_keys')
      .select('api_key_encrypted')
      .eq('user_id', user.id)
      .eq('service', 'openai')
      .eq('is_active', true)
      .maybeSingle()

    if (adminKey?.api_key_encrypted) {
      try {
        apiKey = atob(adminKey.api_key_encrypted)
      } catch (e) {
        console.error('Failed to decrypt admin-assigned API key')
      }
    }

    // Fall back to user's own key
    if (!apiKey) {
      const { data: userKey } = await supabase
        .from('user_api_keys')
        .select('api_key_encrypted')
        .eq('user_id', user.id)
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
      return new Response(
        JSON.stringify({ error: 'No OpenAI API key configured. Please contact your administrator.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Call OpenAI Embeddings API
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        input: text.slice(0, 8000) // Limit input length
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return new Response(
        JSON.stringify({ error: errorData.error?.message || `OpenAI API error: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const data = await response.json()
    const embedding = data.data[0].embedding

    return new Response(
      JSON.stringify({ embedding, usage: data.usage }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('Error in generate-embedding:', error)
    return new Response(
      JSON.stringify({ error: error?.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
