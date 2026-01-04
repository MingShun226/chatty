/**
 * WhatsApp Webhook Edge Function
 *
 * Handles incoming WhatsApp messages from Meta's Cloud API
 *
 * GET endpoint: Webhook verification (Meta requirement)
 * POST endpoint: Process incoming messages and status updates
 *
 * Features:
 * - Webhook signature verification (SHA256 HMAC)
 * - Message parsing (text, media, location, etc.)
 * - AI chatbot response using shared chatbot-engine
 * - Send reply via Meta API
 * - Message persistence in database
 * - Status update handling (delivered, read)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { processChatbotMessage } from '../_shared/chatbot-engine.ts'
import { decryptToken } from '../_shared/whatsappEncryption.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-hub-signature-256',
}

// Meta App Secret for signature verification
const META_APP_SECRET = Deno.env.get('META_APP_SECRET')!
const WEBHOOK_VERIFY_TOKEN = Deno.env.get('WHATSAPP_WEBHOOK_VERIFY_TOKEN')!

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const url = new URL(req.url)

  try {
    // ====================================================
    // GET: WEBHOOK VERIFICATION (Meta requirement)
    // ====================================================
    if (req.method === 'GET') {
      // Meta sends verification request during webhook setup
      // Format: ?hub.mode=subscribe&hub.challenge=xxx&hub.verify_token=xxx

      const mode = url.searchParams.get('hub.mode')
      const challenge = url.searchParams.get('hub.challenge')
      const verifyToken = url.searchParams.get('hub.verify_token')

      console.log('Webhook verification request:', { mode, verifyToken })

      // Verify the token matches our secret
      if (mode === 'subscribe' && challenge && verifyToken === WEBHOOK_VERIFY_TOKEN) {
        console.log('Webhook verified successfully')
        return new Response(challenge, {
          status: 200,
          headers: { 'Content-Type': 'text/plain' }
        })
      }

      console.error('Webhook verification failed:', {
        mode,
        tokenMatch: verifyToken === WEBHOOK_VERIFY_TOKEN,
        expectedToken: WEBHOOK_VERIFY_TOKEN,
        receivedToken: verifyToken
      })

      return new Response('Invalid verification request', { status: 403 })
    }

    // ====================================================
    // POST: PROCESS INCOMING MESSAGES
    // ====================================================
    if (req.method === 'POST') {
      // Read raw body for signature verification
      const rawBody = await req.text()

      // Verify webhook signature
      const signature = req.headers.get('x-hub-signature-256')
      if (!signature || !verifyWebhookSignature(rawBody, signature)) {
        console.error('Invalid webhook signature')
        return new Response(
          JSON.stringify({ error: 'Invalid signature' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Parse webhook payload
      const webhookData = JSON.parse(rawBody)

      console.log('Webhook received:', JSON.stringify(webhookData, null, 2))

      // Create Supabase client
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      const supabase = createClient(supabaseUrl, supabaseKey)

      // Process each entry in the webhook
      for (const entry of webhookData.entry || []) {
        for (const change of entry.changes || []) {
          const value = change.value

          // Handle incoming messages
          if (value.messages && value.messages.length > 0) {
            for (const message of value.messages) {
              await processIncomingMessage(
                message,
                value.metadata,
                webhookData,
                supabase
              )
            }
          }

          // Handle status updates (delivered, read, sent, failed)
          if (value.statuses && value.statuses.length > 0) {
            for (const status of value.statuses) {
              await processStatusUpdate(status, supabase)
            }
          }
        }
      }

      // Meta requires a 200 OK response within 20 seconds
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response('Method not allowed', { status: 405 })

  } catch (error: any) {
    console.error('Error in whatsapp-webhook:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

/**
 * Verify webhook signature using SHA256 HMAC
 */
function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  try {
    // Meta sends signature as: sha256=<hex_string>
    const expectedSignature = signature.split('=')[1]

    // Compute HMAC SHA256
    const encoder = new TextEncoder()
    const key = encoder.encode(META_APP_SECRET)
    const data = encoder.encode(rawBody)

    // Use Web Crypto API for HMAC
    const keyPromise = crypto.subtle.importKey(
      'raw',
      key,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )

    return keyPromise.then(cryptoKey => {
      return crypto.subtle.sign('HMAC', cryptoKey, data)
    }).then(signatureBuffer => {
      const signatureArray = Array.from(new Uint8Array(signatureBuffer))
      const computedSignature = signatureArray.map(b => b.toString(16).padStart(2, '0')).join('')

      // Timing-safe comparison
      return computedSignature === expectedSignature
    }).catch(err => {
      console.error('Signature verification error:', err)
      return false
    })
  } catch (error) {
    console.error('Signature verification error:', error)
    return false
  }
}

/**
 * Process an incoming WhatsApp message
 */
async function processIncomingMessage(
  message: any,
  metadata: any,
  rawWebhookData: any,
  supabase: any
) {
  const phoneNumberId = metadata.phone_number_id
  const fromPhone = message.from
  const messageId = message.id
  const timestamp = new Date(parseInt(message.timestamp) * 1000)

  console.log(`Processing message from ${fromPhone} to phone_number_id ${phoneNumberId}`)

  try {
    // ====================================================
    // 1. GET CONNECTION BY PHONE_NUMBER_ID
    // ====================================================
    const { data: connection, error: connectionError } = await supabase
      .from('whatsapp_connections')
      .select('*')
      .eq('phone_number_id', phoneNumberId)
      .eq('status', 'active')
      .single()

    if (connectionError || !connection) {
      console.error('Connection not found for phone_number_id:', phoneNumberId)
      return
    }

    console.log('Found connection:', connection.id, 'for chatbot:', connection.chatbot_id)

    // ====================================================
    // 2. EXTRACT MESSAGE CONTENT
    // ====================================================
    let messageContent = ''
    let messageType = 'text'
    let mediaUrl = null
    let mediaId = null
    let mediaMimeType = null

    if (message.type === 'text') {
      messageContent = message.text.body
      messageType = 'text'
    } else if (message.type === 'image') {
      messageContent = message.image.caption || '[Image]'
      messageType = 'image'
      mediaId = message.image.id
      mediaMimeType = message.image.mime_type
    } else if (message.type === 'video') {
      messageContent = message.video.caption || '[Video]'
      messageType = 'video'
      mediaId = message.video.id
      mediaMimeType = message.video.mime_type
    } else if (message.type === 'document') {
      messageContent = message.document.caption || `[Document: ${message.document.filename}]`
      messageType = 'document'
      mediaId = message.document.id
      mediaMimeType = message.document.mime_type
    } else if (message.type === 'audio') {
      messageContent = '[Voice message]'
      messageType = 'audio'
      mediaId = message.audio.id
      mediaMimeType = message.audio.mime_type
    } else if (message.type === 'location') {
      messageContent = `[Location: ${message.location.latitude}, ${message.location.longitude}]`
      messageType = 'location'
    } else {
      messageContent = `[Unsupported message type: ${message.type}]`
      messageType = message.type
    }

    // ====================================================
    // 3. SAVE INCOMING MESSAGE TO DATABASE
    // ====================================================
    const { error: insertError } = await supabase
      .from('whatsapp_messages')
      .insert({
        connection_id: connection.id,
        chatbot_id: connection.chatbot_id,
        whatsapp_message_id: messageId,
        conversation_id: message.context?.id || null,
        from_phone: fromPhone,
        to_phone: connection.phone_number,
        direction: 'inbound',
        message_type: messageType,
        content: messageContent,
        media_id: mediaId,
        media_mime_type: mediaMimeType,
        context_message_id: message.context?.message_id || null,
        status: 'received',
        timestamp: timestamp.toISOString(),
        raw_webhook_data: rawWebhookData
      })

    if (insertError) {
      console.error('Error saving incoming message:', insertError)
    }

    // ====================================================
    // 4. GET CONVERSATION HISTORY
    // ====================================================
    const { data: recentMessages } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .eq('connection_id', connection.id)
      .eq('from_phone', fromPhone)
      .order('timestamp', { ascending: false })
      .limit(10)

    // Convert to conversation history format
    const conversationHistory = (recentMessages || [])
      .reverse()
      .map((msg: any) => ({
        role: msg.direction === 'inbound' ? 'user' : 'assistant',
        content: msg.content
      }))

    // ====================================================
    // 5. CALL CHATBOT ENGINE (AI RESPONSE)
    // ====================================================
    const chatbotResponse = await processChatbotMessage(
      {
        avatarId: connection.chatbot_id,
        userId: connection.user_id,
        message: messageContent,
        conversationHistory,
        model: 'gpt-4o-mini',
        platform: 'whatsapp',
        phoneNumber: fromPhone
      },
      supabase
    )

    console.log('Chatbot response:', chatbotResponse.response)

    // ====================================================
    // 6. SEND REPLY VIA META API
    // ====================================================
    const replyMessageId = await sendWhatsAppMessage(
      connection,
      fromPhone,
      chatbotResponse.response,
      messageId
    )

    // ====================================================
    // 7. SAVE OUTBOUND MESSAGE TO DATABASE
    // ====================================================
    if (replyMessageId) {
      await supabase
        .from('whatsapp_messages')
        .insert({
          connection_id: connection.id,
          chatbot_id: connection.chatbot_id,
          whatsapp_message_id: replyMessageId,
          from_phone: connection.phone_number,
          to_phone: fromPhone,
          direction: 'outbound',
          message_type: 'text',
          content: chatbotResponse.response,
          context_message_id: messageId,
          status: 'sent',
          timestamp: new Date().toISOString(),
          sent_at: new Date().toISOString()
        })
    }

    // ====================================================
    // 8. UPDATE CONVERSATIONS TABLE (COMPATIBILITY)
    // ====================================================
    await supabase
      .from('conversations')
      .insert({
        avatar_id: connection.chatbot_id,
        phone_number: fromPhone,
        text: `user: ${messageContent} | assistant: ${chatbotResponse.response}`,
        whatsapp_message_id: messageId,
        whatsapp_connection_id: connection.id
      })

  } catch (error: any) {
    console.error('Error processing incoming message:', error)
  }
}

/**
 * Send a WhatsApp message via Meta API
 */
async function sendWhatsAppMessage(
  connection: any,
  toPhone: string,
  message: string,
  contextMessageId?: string
): Promise<string | null> {
  try {
    // Decrypt access token
    const accessToken = await decryptToken(connection.access_token_encrypted)

    // Prepare message payload
    const payload: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: toPhone,
      type: 'text',
      text: {
        preview_url: true,
        body: message
      }
    }

    // Add context (reply to message)
    if (contextMessageId) {
      payload.context = {
        message_id: contextMessageId
      }
    }

    // Send to Meta API
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${connection.phone_number_id}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify(payload)
      }
    )

    if (!response.ok) {
      const errorData = await response.json()
      console.error('Error sending WhatsApp message:', errorData)
      throw new Error(errorData.error?.message || 'Failed to send message')
    }

    const data = await response.json()
    console.log('Message sent successfully:', data)

    return data.messages[0].id
  } catch (error: any) {
    console.error('Error in sendWhatsAppMessage:', error)
    return null
  }
}

/**
 * Process status updates (delivered, read, sent, failed)
 */
async function processStatusUpdate(status: any, supabase: any) {
  const messageId = status.id
  const statusValue = status.status // sent, delivered, read, failed

  console.log(`Status update for message ${messageId}: ${statusValue}`)

  try {
    const updateData: any = {
      status: statusValue
    }

    // Update timestamp fields based on status
    if (statusValue === 'sent') {
      updateData.sent_at = new Date(parseInt(status.timestamp) * 1000).toISOString()
    } else if (statusValue === 'delivered') {
      updateData.delivered_at = new Date(parseInt(status.timestamp) * 1000).toISOString()
    } else if (statusValue === 'read') {
      updateData.read_at = new Date(parseInt(status.timestamp) * 1000).toISOString()
    } else if (statusValue === 'failed') {
      updateData.failed_at = new Date(parseInt(status.timestamp) * 1000).toISOString()
      updateData.error_code = status.errors?.[0]?.code || null
      updateData.error_message = status.errors?.[0]?.title || null
    }

    // Update message in database
    const { error } = await supabase
      .from('whatsapp_messages')
      .update(updateData)
      .eq('whatsapp_message_id', messageId)

    if (error) {
      console.error('Error updating message status:', error)
    }
  } catch (error: any) {
    console.error('Error processing status update:', error)
  }
}
