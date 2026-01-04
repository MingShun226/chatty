/**
 * WhatsApp OAuth Callback Edge Function
 *
 * Handles OAuth redirect from Meta Embedded Signup
 *
 * Flow:
 * 1. User clicks "Connect WhatsApp" → Opens Meta OAuth dialog
 * 2. User authorizes → Meta redirects here with code
 * 3. Exchange code for access token
 * 4. Get WABA ID and phone numbers
 * 5. Store connections in database with encrypted tokens
 * 6. Redirect to dashboard with success message
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { encryptToken, generateWebhookVerifyToken } from '../_shared/whatsappEncryption.ts'

const META_APP_ID = Deno.env.get('META_APP_ID')!
const META_APP_SECRET = Deno.env.get('META_APP_SECRET')!
const REDIRECT_URI = Deno.env.get('WHATSAPP_OAUTH_REDIRECT_URI') || 'https://your-project.supabase.co/functions/v1/whatsapp-oauth-callback'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const url = new URL(req.url)

  try {
    // ====================================================
    // EXTRACT QUERY PARAMETERS
    // ====================================================
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const error = url.searchParams.get('error')
    const errorReason = url.searchParams.get('error_reason')
    const errorDescription = url.searchParams.get('error_description')

    // Check for OAuth errors
    if (error) {
      console.error('OAuth error:', { error, errorReason, errorDescription })
      return redirectToApp('error', `OAuth failed: ${errorDescription || error}`)
    }

    if (!code || !state) {
      console.error('Missing code or state parameter')
      return redirectToApp('error', 'Missing required parameters')
    }

    // ====================================================
    // DECODE STATE (userId + chatbotId)
    // ====================================================
    let userId: string
    let chatbotId: string

    try {
      const stateData = JSON.parse(atob(state))
      userId = stateData.userId
      chatbotId = stateData.chatbotId

      if (!userId || !chatbotId) {
        throw new Error('Invalid state data')
      }
    } catch (err) {
      console.error('Error decoding state:', err)
      return redirectToApp('error', 'Invalid state parameter')
    }

    console.log('OAuth callback:', { userId, chatbotId })

    // ====================================================
    // EXCHANGE CODE FOR ACCESS TOKEN
    // ====================================================
    const tokenResponse = await fetch('https://graph.facebook.com/v21.0/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: META_APP_ID,
        client_secret: META_APP_SECRET,
        code,
        redirect_uri: REDIRECT_URI
      })
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json()
      console.error('Token exchange error:', errorData)
      return redirectToApp('error', `Token exchange failed: ${errorData.error?.message || 'Unknown error'}`)
    }

    const tokenData = await tokenResponse.json()
    const accessToken = tokenData.access_token

    if (!accessToken) {
      console.error('No access token in response:', tokenData)
      return redirectToApp('error', 'No access token received')
    }

    console.log('Access token obtained successfully')

    // ====================================================
    // GET WHATSAPP BUSINESS ACCOUNT ID (WABA ID)
    // ====================================================

    console.log('Attempting to fetch WhatsApp Business Account information...')

    let wabaId: string | null = null
    let phoneNumbers: any[] = []

    // Method 1: Try getting WABAs directly from the user's account
    // This works if the user has granted whatsapp_business_management permission
    try {
      const wabaResponse = await fetch(
        `https://graph.facebook.com/v21.0/me/businesses?fields=owned_whatsapp_business_accounts{id,name}&access_token=${accessToken}`
      )

      if (wabaResponse.ok) {
        const wabaData = await wabaResponse.json()
        console.log('Business WABA data:', JSON.stringify(wabaData))

        // Check if we got any WABAs
        if (wabaData.data && wabaData.data.length > 0) {
          for (const business of wabaData.data) {
            if (business.owned_whatsapp_business_accounts?.data?.length > 0) {
              wabaId = business.owned_whatsapp_business_accounts.data[0].id
              console.log('Found WABA from business:', wabaId)
              break
            }
          }
        }
      } else {
        console.error('WABA fetch error:', await wabaResponse.text())
      }
    } catch (err) {
      console.error('Error fetching WABAs:', err)
    }

    // Method 2: Try direct me/whatsapp_business_accounts endpoint
    if (!wabaId) {
      try {
        const directWabaResponse = await fetch(
          `https://graph.facebook.com/v21.0/me/whatsapp_business_accounts?access_token=${accessToken}`
        )

        if (directWabaResponse.ok) {
          const directWabaData = await directWabaResponse.json()
          console.log('Direct WABA data:', JSON.stringify(directWabaData))

          if (directWabaData.data && directWabaData.data.length > 0) {
            wabaId = directWabaData.data[0].id
            console.log('Found WABA from direct endpoint:', wabaId)
          }
        } else {
          console.error('Direct WABA fetch error:', await directWabaResponse.text())
        }
      } catch (err) {
        console.error('Error with direct WABA fetch:', err)
      }
    }

    // Method 3: Check the granted scopes to see what access we have
    try {
      const permissionsResponse = await fetch(
        `https://graph.facebook.com/v21.0/me/permissions?access_token=${accessToken}`
      )

      if (permissionsResponse.ok) {
        const permissionsData = await permissionsResponse.json()
        console.log('Granted permissions:', JSON.stringify(permissionsData))
      }
    } catch (err) {
      console.error('Error fetching permissions:', err)
    }

    // Get phone numbers if we have a WABA
    if (wabaId) {
      try {
        const phoneResponse = await fetch(
          `https://graph.facebook.com/v21.0/${wabaId}/phone_numbers?access_token=${accessToken}`
        )

        if (phoneResponse.ok) {
          const phoneData = await phoneResponse.json()
          phoneNumbers = phoneData.data || []
          console.log(`Found ${phoneNumbers.length} phone number(s) for WABA ${wabaId}`)
        } else {
          console.error('Phone numbers fetch error:', await phoneResponse.text())
        }
      } catch (err) {
        console.error('Error fetching phone numbers:', err)
      }
    }

    if (!wabaId || phoneNumbers.length === 0) {
      console.error('Could not find WhatsApp Business Account or phone numbers')
      console.error('WABA ID:', wabaId)
      console.error('Phone numbers count:', phoneNumbers.length)

      // Provide helpful error message with setup instructions
      const errorMessage = !wabaId
        ? 'No WhatsApp Business Account found. To connect WhatsApp:\n\n1. Go to Meta Business Manager (business.facebook.com)\n2. Create a WhatsApp Business Account\n3. Add a phone number\n4. Then return here to connect'
        : 'WhatsApp Business Account found, but no phone numbers. Please add a phone number in Meta Business Manager first.'

      return redirectToApp('error', errorMessage)
    }

    console.log('Found WABA:', wabaId, 'with', phoneNumbers.length, 'phone number(s)')

    // ====================================================
    // STORE CONNECTIONS IN DATABASE
    // ====================================================
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    let connectedCount = 0

    for (const phone of phoneNumbers) {
      try {
        // Encrypt access token
        const encryptedToken = await encryptToken(accessToken)

        // Generate webhook verify token
        const webhookToken = generateWebhookVerifyToken()

        // Insert connection
        const { data, error } = await supabase
          .from('whatsapp_connections')
          .insert({
            user_id: userId,
            chatbot_id: chatbotId,
            waba_id: wabaId,
            phone_number_id: phone.id,
            phone_number: phone.display_phone_number,
            display_name: phone.verified_name || phone.display_phone_number,
            quality_rating: phone.quality_rating || 'UNKNOWN',
            access_token_encrypted: encryptedToken,
            webhook_verify_token: webhookToken,
            status: 'active',
            is_verified: phone.code_verification_status === 'VERIFIED',
            messaging_limit: phone.messaging_limit_tier || 'TIER_50'
          })
          .select()

        if (error) {
          console.error('Error inserting connection:', error)
          continue
        }

        console.log('Connection created:', data)
        connectedCount++

        // TODO: Register webhook with Meta for this phone number
        // This would be done via Meta's API:
        // POST /{waba_id}/subscribed_apps
        // But it requires webhook setup on Meta's side first

      } catch (err) {
        console.error('Error processing phone number:', phone.id, err)
      }
    }

    if (connectedCount === 0) {
      return redirectToApp('error', 'Failed to create any connections')
    }

    console.log(`Successfully connected ${connectedCount} phone number(s)`)

    // ====================================================
    // REDIRECT TO DASHBOARD WITH SUCCESS MESSAGE
    // ====================================================
    return redirectToApp('success', `Successfully connected ${connectedCount} WhatsApp number(s)!`)

  } catch (error: any) {
    console.error('Error in whatsapp-oauth-callback:', error)
    return redirectToApp('error', error.message || 'Internal server error')
  }
})

/**
 * Redirect to app with status message
 */
function redirectToApp(status: 'success' | 'error', message: string): Response {
  // Construct redirect URL (replace with your actual app URL)
  const appUrl = Deno.env.get('APP_URL') || 'http://localhost:5173'
  const redirectUrl = `${appUrl}/chatbot/whatsapp?whatsapp_oauth=${status}&message=${encodeURIComponent(message)}`

  console.log('Redirecting to:', redirectUrl)

  return new Response(null, {
    status: 302,
    headers: {
      'Location': redirectUrl,
      ...corsHeaders
    }
  })
}
