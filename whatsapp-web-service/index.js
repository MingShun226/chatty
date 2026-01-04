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

    // Connection update event
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update

      console.log(`Connection update for ${sessionId}:`, { connection, hasQr: !!qr, statusCode: lastDisconnect?.error?.output?.statusCode })

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
          // Remove old socket before reconnecting
          whatsappSockets.delete(sessionId)

          // Reconnect after delay
          console.log(`Reconnecting session ${sessionId} in 5 seconds...`)
          setTimeout(() => initializeWhatsAppSocket(sessionId, chatbotId, userId), 5000)
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

          // Skip empty messages (system/sync messages during connection)
          if (!messageText || messageText.trim() === '') {
            console.log('Skipping empty message (likely system/sync message)')
            return
          }

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
 * Split long message into chunks using custom delimiter or sentence boundaries
 * @param {string} text - Message text to split
 * @param {string|null} delimiter - Custom delimiter (e.g., "||") or null for auto-split
 * @param {number} maxLength - Maximum length per chunk (default: 1500)
 */
function splitMessage(text, delimiter = null, maxLength = 1500) {
  // If custom delimiter is specified, split by delimiter first
  if (delimiter && text.includes(delimiter)) {
    const parts = text.split(delimiter).map(part => part.trim()).filter(part => part.length > 0)

    // Further split parts that exceed maxLength
    const chunks = []
    for (const part of parts) {
      if (part.length <= maxLength) {
        chunks.push(part)
      } else {
        // Part too long, split by sentences
        chunks.push(...splitBySentences(part, maxLength))
      }
    }
    return chunks
  }

  // No delimiter or delimiter not found, use automatic sentence splitting
  if (text.length <= maxLength) {
    return [text]
  }

  return splitBySentences(text, maxLength)
}

/**
 * Split text by sentence boundaries
 */
function splitBySentences(text, maxLength = 1500) {
  const chunks = []
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text]
  let currentChunk = ''

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > maxLength) {
      if (currentChunk) {
        chunks.push(currentChunk.trim())
        currentChunk = sentence
      } else {
        // Single sentence is too long, split by words
        const words = sentence.split(' ')
        let wordChunk = ''
        for (const word of words) {
          if ((wordChunk + word + ' ').length > maxLength) {
            chunks.push(wordChunk.trim())
            wordChunk = word + ' '
          } else {
            wordChunk += word + ' '
          }
        }
        if (wordChunk) chunks.push(wordChunk.trim())
      }
    } else {
      currentChunk += sentence
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim())
  }

  return chunks
}

/**
 * Send WhatsApp message with typing indicator and message splitting
 * @param {object} sock - WhatsApp socket
 * @param {string} toNumber - Recipient number
 * @param {string} text - Message text
 * @param {string|null} delimiter - Custom delimiter for splitting (e.g., "||")
 * @param {number} wpm - Typing speed in words per minute (default: 200)
 */
async function sendWhatsAppMessage(sock, toNumber, text, delimiter = null, wpm = 200) {
  try {
    // Split long messages
    const messageChunks = splitMessage(text, delimiter)

    for (let i = 0; i < messageChunks.length; i++) {
      const chunk = messageChunks[i]

      // Show typing indicator
      await sock.sendPresenceUpdate('composing', toNumber)

      // Calculate realistic typing delay based on WPM
      // Formula: (words / WPM) * 60000ms + small buffer
      const wordCount = chunk.split(/\s+/).length
      const typingDelayMs = (wordCount / wpm) * 60000

      // Add small random variation (±10%) for more natural feel
      const variation = typingDelayMs * 0.1 * (Math.random() * 2 - 1)
      const finalDelay = Math.min(Math.max(typingDelayMs + variation, 800), 5000) // Min 800ms, max 5s

      console.log(`Typing ${wordCount} words at ${wpm} WPM: ${Math.round(finalDelay)}ms delay`)
      await new Promise(resolve => setTimeout(resolve, finalDelay))

      // Send the message
      await sock.sendMessage(toNumber, { text: chunk })

      // Pause briefly between chunks
      if (i < messageChunks.length - 1) {
        await sock.sendPresenceUpdate('paused', toNumber)
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    // Clear typing indicator
    await sock.sendPresenceUpdate('paused', toNumber)

    return messageChunks
  } catch (err) {
    console.error('Error sending WhatsApp message:', err)
    throw err
  }
}

/**
 * Process inbound message with chatbot (n8n integration)
 */
async function processInboundMessage(sessionId, chatbotId, fromNumber, messageText, sock) {
  try {
    // Get chatbot details with all related data
    const { data: chatbot } = await supabase
      .from('avatars')
      .select('*')
      .eq('id', chatbotId)
      .single()

    if (!chatbot) {
      console.error('Chatbot not found:', chatbotId)
      return
    }

    // Get products for this chatbot
    const { data: products, error: productsError } = await supabase
      .from('chatbot_products')
      .select('*')
      .eq('chatbot_id', chatbotId)

    if (productsError) {
      console.error('Error fetching products:', productsError)
    } else {
      console.log(`Fetched ${products?.length || 0} products for chatbot ${chatbotId}`)
    }

    // Get knowledge base for this chatbot
    const { data: knowledgeBase, error: knowledgeError } = await supabase
      .from('avatar_knowledge_files')
      .select('*')
      .eq('avatar_id', chatbotId)

    if (knowledgeError) {
      console.error('Error fetching knowledge base:', knowledgeError)
    } else {
      console.log(`Fetched ${knowledgeBase?.length || 0} knowledge base files for chatbot ${chatbotId}`)
    }

    // Get conversation history for this user
    const { data: conversationHistory } = await supabase
      .from('whatsapp_web_messages')
      .select('*')
      .eq('chatbot_id', chatbotId)
      .eq('from_number', fromNumber)
      .order('timestamp', { ascending: false })
      .limit(10)

    // Check if n8n webhook URL is configured for this chatbot (SaaS multi-tenant)
    const n8nWebhookUrl = chatbot.n8n_enabled ? chatbot.n8n_webhook_url : null

    let reply

    if (n8nWebhookUrl) {
      // Call n8n webhook with full context
      console.log(`Calling n8n webhook for chatbot ${chatbotId}...`)

      const response = await fetch(n8nWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          // Message info
          message: messageText,
          from_number: fromNumber,

          // Chatbot configuration
          chatbot: {
            id: chatbot.id,
            name: chatbot.name,
            company_name: chatbot.company_name,
            industry: chatbot.industry,
            system_prompt: chatbot.system_prompt,
            business_context: chatbot.business_context,
            compliance_rules: chatbot.compliance_rules,
            response_guidelines: chatbot.response_guidelines
          },

          // Products
          products: products || [],

          // Knowledge base
          knowledge_base: knowledgeBase || [],

          // Conversation history
          conversation_history: conversationHistory || []
        })
      })

      if (!response.ok) {
        console.error('Error calling n8n webhook:', await response.text())
        return
      }

      const result = await response.json()
      console.log('Full n8n response:', JSON.stringify(result, null, 2))

      // n8n returns array format: [{"reply": "..."}]
      // Extract first item if array
      const data = Array.isArray(result) ? result[0] : result

      reply = data?.reply || data?.response || data?.message

      console.log('Extracted reply:', reply)

      if (!reply) {
        console.error('Warning: No reply found in n8n response. Full response:', result)
        reply = 'Sorry, I could not generate a response.'
      }

      // Update n8n last used timestamp
      await supabase
        .from('avatars')
        .update({ n8n_last_used_at: new Date().toISOString() })
        .eq('id', chatbotId)

    } else {
      // Fallback to edge function if n8n not configured
      console.log('n8n not configured for this chatbot, using edge function...')

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

      const result = await response.json()
      reply = result.reply
    }

    // Get WhatsApp settings from chatbot configuration
    const messageDelimiter = chatbot.whatsapp_message_delimiter || null
    const typingWPM = chatbot.whatsapp_typing_wpm || 200

    console.log(`WhatsApp settings - Delimiter: ${messageDelimiter || 'auto'}, Typing speed: ${typingWPM} WPM`)

    // Send reply via WhatsApp with typing indicator and message splitting
    const sentChunks = await sendWhatsAppMessage(sock, fromNumber, reply, messageDelimiter, typingWPM)

    // Store outbound message(s)
    const sessionUuid = await getSessionIdFromDb(sessionId)
    for (const chunk of sentChunks) {
      await supabase
        .from('whatsapp_web_messages')
        .insert({
          session_id: sessionUuid,
          chatbot_id: chatbotId,
          message_id: `out_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
          from_number: sock.user?.id || '',
          to_number: fromNumber,
          direction: 'outbound',
          message_type: 'text',
          content: chunk,
          timestamp: new Date().toISOString()
        })
    }

    console.log(`Reply sent successfully (${sentChunks.length} message${sentChunks.length > 1 ? 's' : ''})`)
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
