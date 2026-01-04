/**
 * WhatsApp Web Service for AvatarLab
 *
 * This service manages WhatsApp Web connections using QR code authentication.
 * It runs as a standalone Node.js server that integrates with Supabase.
 *
 * Features:
 * - Generate QR codes for WhatsApp Web authentication
 * - Maintain multiple WhatsApp sessions (one per chatbot)
 * - Receive and send messages
 * - Store messages in Supabase database
 */

import pkg from 'whatsapp-web.js'
const { Client, LocalAuth } = pkg
import QRCode from 'qrcode'
import express from 'express'
import cors from 'cors'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

// Configuration
const PORT = process.env.PORT || 3001
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// Initialize Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// Store active WhatsApp clients
const whatsappClients = new Map() // sessionId -> Client instance

// Initialize Express
const app = express()
app.use(cors())
app.use(express.json())

/**
 * Initialize a WhatsApp client for a session
 */
async function initializeWhatsAppClient(sessionId, chatbotId, userId) {
  console.log(`Initializing WhatsApp client for session: ${sessionId}`)

  // Check if client already exists
  if (whatsappClients.has(sessionId)) {
    console.log(`Client already exists for session: ${sessionId}`)
    return whatsappClients.get(sessionId)
  }

  // Create new client
  console.log(`Creating WhatsApp client with LocalAuth for session: ${sessionId}`)
  const client = new Client({
    authStrategy: new LocalAuth({
      clientId: sessionId
    }),
    puppeteer: {
      headless: false, // VISIBLE MODE - to debug what's happening
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ]
    }
  })

  console.log(`WhatsApp client created, setting up event listeners...`)

  // QR Code event
  client.on('qr', async (qr) => {
    console.log(`QR code received for session: ${sessionId}`)

    try {
      // Generate QR code as base64 image
      const qrCodeDataUrl = await QRCode.toDataURL(qr)

      // Update session in database with QR code
      const { error } = await supabase
        .from('whatsapp_web_sessions')
        .update({
          status: 'qr_ready',
          qr_code: qrCodeDataUrl,
          qr_expires_at: new Date(Date.now() + 60000).toISOString(), // QR expires in 1 minute
          updated_at: new Date().toISOString()
        })
        .eq('session_id', sessionId)

      if (error) {
        console.error('Error updating QR code:', error)
      } else {
        console.log(`QR code stored in database for session: ${sessionId}`)
      }
    } catch (err) {
      console.error('Error generating QR code:', err)
    }
  })

  // Ready event (authenticated and ready to use)
  client.on('ready', async () => {
    console.log(`WhatsApp client ready for session: ${sessionId}`)

    try {
      // Get phone number
      const info = await client.info
      const phoneNumber = info.wid.user

      // Update session status
      const { error } = await supabase
        .from('whatsapp_web_sessions')
        .update({
          status: 'connected',
          phone_number: phoneNumber,
          connected_at: new Date().toISOString(),
          last_active_at: new Date().toISOString(),
          qr_code: null, // Clear QR code
          updated_at: new Date().toISOString()
        })
        .eq('session_id', sessionId)

      if (error) {
        console.error('Error updating session status:', error)
      } else {
        console.log(`Session connected: ${sessionId} (${phoneNumber})`)
      }
    } catch (err) {
      console.error('Error in ready event:', err)
    }
  })

  // Loading event (when browser is launching)
  client.on('loading_screen', (percent, message) => {
    console.log(`Loading ${sessionId}: ${percent}% - ${message}`)
  })

  // Authenticated event
  client.on('authenticated', () => {
    console.log(`WhatsApp client authenticated for session: ${sessionId}`)
  })

  // Authentication failure event
  client.on('auth_failure', async (msg) => {
    console.error(`Authentication failed for session ${sessionId}:`, msg)

    await supabase
      .from('whatsapp_web_sessions')
      .update({
        status: 'failed',
        disconnect_reason: `Authentication failed: ${msg}`,
        updated_at: new Date().toISOString()
      })
      .eq('session_id', sessionId)
  })

  // Disconnected event
  client.on('disconnected', async (reason) => {
    console.log(`WhatsApp client disconnected for session ${sessionId}:`, reason)

    await supabase
      .from('whatsapp_web_sessions')
      .update({
        status: 'disconnected',
        disconnect_reason: reason,
        updated_at: new Date().toISOString()
      })
      .eq('session_id', sessionId)

    // Remove client from map
    whatsappClients.delete(sessionId)
  })

  // Message event
  client.on('message', async (message) => {
    console.log(`Message received on session ${sessionId}:`, message.from)

    try {
      // Store message in database
      const { error } = await supabase
        .from('whatsapp_web_messages')
        .insert({
          session_id: (await getSessionIdFromDb(sessionId)),
          chatbot_id: chatbotId,
          message_id: message.id._serialized,
          from_number: message.from,
          to_number: message.to,
          direction: 'inbound',
          message_type: message.type || 'text',
          content: message.body,
          timestamp: new Date(message.timestamp * 1000).toISOString()
        })

      if (error) {
        console.error('Error storing message:', error)
      }

      // Process message with chatbot (integrate with avatar-chat function)
      await processInboundMessage(sessionId, chatbotId, message)
    } catch (err) {
      console.error('Error handling message:', err)
    }
  })

  // Store client
  whatsappClients.set(sessionId, client)

  // Initialize client with timeout
  try {
    console.log(`Starting client.initialize() for session: ${sessionId}...`)

    // Wrap initialization in a timeout
    const initPromise = client.initialize()
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Initialization timeout after 60 seconds')), 60000)
    )

    await Promise.race([initPromise, timeoutPromise])
    console.log(`Client initialization completed for session: ${sessionId}`)
  } catch (err) {
    console.error(`Error initializing client for session ${sessionId}:`, err)
    console.error('Full error stack:', err.stack)

    await supabase
      .from('whatsapp_web_sessions')
      .update({
        status: 'failed',
        disconnect_reason: `Initialization error: ${err.message}`,
        updated_at: new Date().toISOString()
      })
      .eq('session_id', sessionId)

    whatsappClients.delete(sessionId)
  }

  return client
}

/**
 * Get session UUID from session_id string
 */
async function getSessionIdFromDb(sessionIdString) {
  const { data } = await supabase
    .from('whatsapp_web_sessions')
    .select('id')
    .eq('session_id', sessionIdString)
    .single()

  return data?.id
}

/**
 * Process inbound message with chatbot
 */
async function processInboundMessage(sessionId, chatbotId, message) {
  try {
    // Get chatbot details
    const { data: chatbot } = await supabase
      .from('avatars')
      .select('*')
      .eq('id', chatbotId)
      .single()

    if (!chatbot) {
      console.error('Chatbot not found:', chatbotId)
      return
    }

    // Call avatar-chat edge function
    const { data: session } = await supabase.auth.getSession()

    const response = await fetch(`${SUPABASE_URL}/functions/v1/avatar-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({
        message: message.body,
        avatar_id: chatbotId,
        user_identifier: message.from
      })
    })

    if (!response.ok) {
      console.error('Error calling avatar-chat:', await response.text())
      return
    }

    const { reply } = await response.json()

    // Send reply via WhatsApp
    const client = whatsappClients.get(sessionId)
    if (client) {
      await client.sendMessage(message.from, reply)

      // Store outbound message
      await supabase
        .from('whatsapp_web_messages')
        .insert({
          session_id: (await getSessionIdFromDb(sessionId)),
          chatbot_id: chatbotId,
          message_id: `out_${Date.now()}`,
          from_number: message.to,
          to_number: message.from,
          direction: 'outbound',
          message_type: 'text',
          content: reply,
          timestamp: new Date().toISOString()
        })

      console.log('Reply sent successfully')
    }
  } catch (err) {
    console.error('Error processing inbound message:', err)
  }
}

// ====================================================
// REST API ENDPOINTS
// ====================================================

/**
 * POST /api/sessions/create
 * Create a new WhatsApp Web session
 */
app.post('/api/sessions/create', async (req, res) => {
  try {
    const { userId, chatbotId } = req.body

    if (!userId || !chatbotId) {
      return res.status(400).json({ error: 'userId and chatbotId are required' })
    }

    // Delete any existing session for this user+chatbot
    const { error: deleteError } = await supabase
      .from('whatsapp_web_sessions')
      .delete()
      .eq('user_id', userId)
      .eq('chatbot_id', chatbotId)

    if (deleteError) {
      console.error('Error deleting old session:', deleteError)
    }

    // Generate unique session ID
    const sessionId = `wa_${userId}_${chatbotId}_${Date.now()}`

    // Create session in database
    const { data: session, error } = await supabase
      .from('whatsapp_web_sessions')
      .insert({
        user_id: userId,
        chatbot_id: chatbotId,
        session_id: sessionId,
        status: 'pending',
        session_data: {}
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating session:', error)
      return res.status(500).json({ error: 'Failed to create session' })
    }

    // Initialize WhatsApp client (async, will generate QR code)
    initializeWhatsAppClient(sessionId, chatbotId, userId)

    res.json({
      success: true,
      sessionId,
      message: 'Session created. QR code will be available shortly.'
    })
  } catch (err) {
    console.error('Error in /api/sessions/create:', err)
    res.status(500).json({ error: err.message })
  }
})

/**
 * POST /api/sessions/disconnect
 * Disconnect a WhatsApp Web session
 */
app.post('/api/sessions/disconnect', async (req, res) => {
  try {
    const { sessionId } = req.body

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' })
    }

    const client = whatsappClients.get(sessionId)
    if (client) {
      await client.destroy()
      whatsappClients.delete(sessionId)
    }

    // Update database
    await supabase
      .from('whatsapp_web_sessions')
      .update({
        status: 'disconnected',
        disconnect_reason: 'User requested disconnect',
        updated_at: new Date().toISOString()
      })
      .eq('session_id', sessionId)

    res.json({ success: true })
  } catch (err) {
    console.error('Error in /api/sessions/disconnect:', err)
    res.status(500).json({ error: err.message })
  }
})

/**
 * POST /api/messages/send
 * Send a WhatsApp message
 */
app.post('/api/messages/send', async (req, res) => {
  try {
    const { sessionId, to, message } = req.body

    if (!sessionId || !to || !message) {
      return res.status(400).json({ error: 'sessionId, to, and message are required' })
    }

    const client = whatsappClients.get(sessionId)
    if (!client) {
      return res.status(404).json({ error: 'Session not found or not connected' })
    }

    // Format phone number (add @c.us if not present)
    const formattedNumber = to.includes('@') ? to : `${to}@c.us`

    // Send message
    await client.sendMessage(formattedNumber, message)

    res.json({ success: true })
  } catch (err) {
    console.error('Error in /api/messages/send:', err)
    res.status(500).json({ error: err.message })
  }
})

/**
 * GET /api/health
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    activeSessions: whatsappClients.size,
    timestamp: new Date().toISOString()
  })
})

// ====================================================
// STARTUP
// ====================================================

async function startServer() {
  // Restore existing sessions from database
  console.log('Restoring existing sessions from database...')

  const { data: sessions } = await supabase
    .from('whatsapp_web_sessions')
    .select('*')
    .in('status', ['connected', 'qr_ready', 'pending'])

  if (sessions && sessions.length > 0) {
    console.log(`Found ${sessions.length} existing session(s) to restore`)

    for (const session of sessions) {
      try {
        await initializeWhatsAppClient(
          session.session_id,
          session.chatbot_id,
          session.user_id
        )
      } catch (err) {
        console.error(`Error restoring session ${session.session_id}:`, err)
      }
    }
  } else {
    console.log('No existing sessions to restore')
  }

  // Start Express server
  app.listen(PORT, () => {
    console.log(`WhatsApp Web Service running on port ${PORT}`)
    console.log(`Health check: http://localhost:${PORT}/api/health`)
  })
}

startServer().catch(console.error)
