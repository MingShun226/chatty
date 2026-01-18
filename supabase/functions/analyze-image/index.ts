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
    const { imageUrl, prompt, context, model = 'gpt-4o', detail = 'high' } = await req.json()

    if (!imageUrl) {
      return new Response(
        JSON.stringify({ error: 'Image URL is required' }),
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

    // Build the analysis prompt
    const contextPrompt = context ? `\n\nUser context: ${context}` : ''
    const analysisPrompt = prompt || `Analyze this image in detail. Extract all relevant information.${contextPrompt}

Return a JSON object with:
{
  "description": "Detailed 2-3 sentence description of what's in the image",
  "location": "Specific place/location if visible or implied",
  "people": ["list of people if visible"],
  "activities": ["what activities/actions are happening"],
  "food_items": ["specific foods/drinks visible if any"],
  "objects": ["notable objects/items visible"],
  "mood": "overall mood/atmosphere",
  "summary": "One sentence summary",
  "conversational_hooks": ["3-5 natural phrases to reference this"],
  "suggested_title": "Short title for this image"
}`

    // Call OpenAI Vision API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert image analyst. Analyze images to extract detailed information. Always respond with valid JSON.'
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: analysisPrompt },
              {
                type: 'image_url',
                image_url: { url: imageUrl, detail: detail }
              }
            ]
          }
        ],
        max_tokens: 1500,
        temperature: 0.3
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
    const analysisText = data.choices[0]?.message?.content || '{}'

    // Try to parse as JSON
    let analysis
    try {
      analysis = JSON.parse(analysisText)
    } catch {
      // Try to extract JSON from text
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        try {
          analysis = JSON.parse(jsonMatch[0])
        } catch {
          analysis = { description: analysisText, raw: true }
        }
      } else {
        analysis = { description: analysisText, raw: true }
      }
    }

    return new Response(
      JSON.stringify({ analysis, usage: data.usage }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('Error in analyze-image:', error)
    return new Response(
      JSON.stringify({ error: error?.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
