/**
 * WhatsApp Web Service for AvatarLab (Using Baileys)
 *
 * This service manages WhatsApp Web connections using Baileys library.
 * Baileys connects directly to WhatsApp's WebSocket (no Chrome/Puppeteer needed).
 *
 * Features:
 * - Generate QR codes for WhatsApp Web authentication
 * - Maintain multiple WhatsApp sessions (one per chatbot)
 * - Receive and send messages
 * - Store messages in Supabase database
 */

import makeWASocket, { DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys'
import QRCode from 'qrcode'
import express from 'express'
import cors from 'cors'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { Boom } from '@hapi/boom'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config()

// Configuration
const PORT = process.env.PORT || 3001
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// Initialize Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// Store active WhatsApp sockets
const whatsappSockets = new Map() // sessionId -> { sock, chatbotId, userId }

// Initialize Express
const app = express()
app.use(cors())
app.use(express.json())

/**
 * Initialize a WhatsApp socket for a session
 */
async function initializeWhatsAppSocket(sessionId, chatbotId, userId) {
  console.log(`Initializing WhatsApp socket for session: ${sessionId}`)

  // Check if socket already exists
  if (whatsappSockets.has(sessionId)) {
    console.log(`Socket already exists for session: ${sessionId}`)
    return whatsappSockets.get(sessionId).sock
  }

  try {
    // Create auth directory for this session
    const authDir = path.join(__dirname, '.baileys_auth', sessionId)

    // Load auth state
    const { state, saveCreds } = await useMultiFileAuthState(authDir)

    // Create socket
    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false, // We'll handle QR code ourselves
      browser: ['AvatarLab', 'Chrome', '1.0.0']
    })

    // Store socket
    whatsappSockets.set(sessionId, { sock, chatbotId, userId })

    // QR Code event
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update

      // QR code received
      if (qr) {
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
              qr_expires_at: new Date(Date.now() + 60000).toISOString(),
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
      }

      // Connection opened
      if (connection === 'open') {
        console.log(`WhatsApp socket connected for session: ${sessionId}`)

        try {
          // Get phone number
          const phoneNumber = sock.user.id.split(':')[0]

          // Update session status
          const { error } = await supabase
            .from('whatsapp_web_sessions')
            .update({
              status: 'connected',
              phone_number: phoneNumber,
              connected_at: new Date().toISOString(),
              last_active_at: new Date().toISOString(),
              qr_code: null,
              updated_at: new Date().toISOString()
            })
            .eq('session_id', sessionId)

          if (error) {
            console.error('Error updating session status:', error)
          } else {
            console.log(`Session connected: ${sessionId} (${phoneNumber})`)
          }
        } catch (err) {
          console.error('Error in connection open:', err)
        }
      }

      // Connection closed
      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error)?.output?.statusCode
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut

        console.log(`Connection closed for session ${sessionId}. Status: ${statusCode}, Reconnect: ${shouldReconnect}`)

        if (!shouldReconnect) {
          // Update database
          await supabase
            .from('whatsapp_web_sessions')
            .update({
              status: 'disconnected',
              disconnect_reason: 'Logged out',
              updated_at: new Date().toISOString()
            })
            .eq('session_id', sessionId)

          // Remove socket
          whatsappSockets.delete(sessionId)
        } else {
          // Reconnect
          setTimeout(() => initializeWhatsAppSocket(sessionId, chatbotId, userId), 3000)
        }
      }
    })

    // Save credentials when updated
    sock.ev.on('creds.update', saveCreds)

    // Message received event
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return

      for (const msg of messages) {
        if (msg.key.fromMe) continue // Skip messages sent by us

        try {
          const messageText = msg.message?.conversation ||
                             msg.message?.extendedTextMessage?.text ||
                             ''

          const fromNumber = msg.key.remoteJid

          console.log(`Message received on session ${sessionId}: ${fromNumber}`)

          // Store message in database
          const { error } = await supabase
            .from('whatsapp_web_messages')
            .insert({
              session_id: (await getSessionIdFromDb(sessionId)),
              chatbot_id: chatbotId,
              message_id: msg.key.id,
              from_number: fromNumber,
              to_number: sock.user?.id || '',
              direction: 'inbound',
              message_type: 'text',
              content: messageText,
              timestamp: new Date(msg.messageTimestamp * 1000).toISOString()
            })

          if (error) {
            console.error('Error storing message:', error)
          }

          // Process message with chatbot
          await processInboundMessage(sessionId, chatbotId, fromNumber, messageText, sock)
        } catch (err) {
          console.error('Error handling message:', err)
        }
      }
    })

    console.log(`WhatsApp socket initialized for session: ${sessionId}`)
    return sock

  } catch (err) {
    console.error(`Error initializing socket for session ${sessionId}:`, err)

    await supabase
      .from('whatsapp_web_sessions')
      .update({
        status: 'failed',
        disconnect_reason: `Initialization error: ${err.message}`,
        updated_at: new Date().toISOString()
      })
      .eq('session_id', sessionId)

    throw err
  }
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
async function processInboundMessage(sessionId, chatbotId, fromNumber, messageText, sock) {
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
    const response = await fetch(`${SUPABASE_URL}/functions/v1/avatar-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({
        message: messageText,
        avatar_id: chatbotId,
        user_identifier: fromNumber
      })
    })

    if (!response.ok) {
      console.error('Error calling avatar-chat:', await response.text())
      return
    }

    const { reply } = await response.json()

    // Send reply via WhatsApp
    await sock.sendMessage(fromNumber, { text: reply })

    // Store outbound message
    await supabase
      .from('whatsapp_web_messages')
      .insert({
        session_id: (await getSessionIdFromDb(sessionId)),
        chatbot_id: chatbotId,
        message_id: `out_${Date.now()}`,
        from_number: sock.user?.id || '',
        to_number: fromNumber,
        direction: 'outbound',
        message_type: 'text',
        content: reply,
        timestamp: new Date().toISOString()
      })

    console.log('Reply sent successfully')
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

    // Initialize WhatsApp socket (async, will generate QR code)
    initializeWhatsAppSocket(sessionId, chatbotId, userId)

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

    const socketData = whatsappSockets.get(sessionId)
    if (socketData) {
      await socketData.sock.logout()
      whatsappSockets.delete(sessionId)
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

    const socketData = whatsappSockets.get(sessionId)
    if (!socketData) {
      return res.status(404).json({ error: 'Session not found or not connected' })
    }

    // Send message
    await socketData.sock.sendMessage(to, { text: message })

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
    activeSessions: whatsappSockets.size,
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
        await initializeWhatsAppSocket(
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
