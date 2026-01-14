// Supabase Edge Function for Admin Impersonation
// Allows admins to login as any user for support purposes
// Endpoint: POST /admin-impersonate
// Body: { targetUserId: string, targetEmail: string }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // Client for verifying the caller's auth
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Client with service role for admin operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify the caller's JWT token
    const token = authHeader.replace('Bearer ', '')
    const { data: { user: callerUser }, error: authError } = await supabaseAuth.auth.getUser(token)

    if (authError || !callerUser) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if caller is an admin
    const { data: adminUser, error: adminError } = await supabaseAdmin
      .from('admin_users')
      .select('id, role, is_active')
      .eq('user_id', callerUser.id)
      .eq('is_active', true)
      .single()

    if (adminError || !adminUser) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized. Admin access required.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Only super_admin and admin roles can impersonate
    if (!['super_admin', 'admin'].includes(adminUser.role)) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions. Only super_admin and admin can impersonate users.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get request body
    const { targetUserId, targetEmail } = await req.json()

    if (!targetUserId || !targetEmail) {
      return new Response(
        JSON.stringify({ error: 'Missing targetUserId or targetEmail' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify target user exists and is active
    const { data: targetUser, error: targetError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, account_status')
      .eq('id', targetUserId)
      .single()

    if (targetError || !targetUser) {
      return new Response(
        JSON.stringify({ error: 'Target user not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (targetUser.account_status !== 'active') {
      return new Response(
        JSON.stringify({ error: 'Cannot impersonate inactive user' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate magic link for the target user
    const siteUrl = Deno.env.get('SITE_URL') || 'https://chatty.my'

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: targetEmail,
      options: {
        redirectTo: `${siteUrl}/dashboard`
      }
    })

    if (linkError || !linkData) {
      console.error('Error generating magic link:', linkError)
      return new Response(
        JSON.stringify({ error: 'Failed to generate login link' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Log the impersonation action for audit
    await supabaseAdmin.from('admin_audit_logs').insert({
      admin_user_id: adminUser.id,
      action: 'impersonate_user',
      resource_type: 'user',
      resource_id: targetUserId,
      description: `Admin ${callerUser.email} logged in as ${targetEmail}`,
      severity: 'warning'
    })

    // Return the magic link URL
    // The action_link contains the full URL with the token
    return new Response(
      JSON.stringify({
        url: linkData.properties?.action_link || linkData.properties?.hashed_token,
        message: 'Login link generated successfully'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error in admin-impersonate:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
