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

import makeWASocket, { DisconnectReason, useMultiFileAuthState, downloadMediaMessage } from '@whiskeysockets/baileys'
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

// Message batching buffers and timers
// Structure: Map<key, { messages: string[], timer: NodeJS.Timeout, chatbotId: string }>
// Key format: `${sessionId}_${fromNumber}`
const messageBatchBuffers = new Map()

/**
 * Upload media (image/video/document) to Supabase Storage
 * Returns the public URL of the uploaded file
 */
async function uploadMediaToStorage(buffer, mimeType, chatbotId, fromNumber) {
  try {
    // Determine file extension from mime type
    const extensions = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'video/mp4': 'mp4',
      'audio/ogg': 'ogg',
      'audio/mpeg': 'mp3',
      'application/pdf': 'pdf'
    }
    const ext = extensions[mimeType] || 'bin'

    // Create unique filename
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2, 8)
    const cleanNumber = fromNumber.replace('@s.whatsapp.net', '').replace(/[^0-9]/g, '')
    const fileName = `${cleanNumber}/${timestamp}_${randomId}.${ext}`
    const bucketName = 'whatsapp-media'

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(fileName, buffer, {
        contentType: mimeType,
        upsert: false
      })

    if (error) {
      // If bucket doesn't exist, try to create it
      if (error.message.includes('not found') || error.statusCode === 404) {
        console.log('Bucket not found, creating whatsapp-media bucket...')
        await supabase.storage.createBucket(bucketName, {
          public: true,
          fileSizeLimit: 52428800 // 50MB
        })

        // Retry upload
        const { data: retryData, error: retryError } = await supabase.storage
          .from(bucketName)
          .upload(fileName, buffer, {
            contentType: mimeType,
            upsert: false
          })

        if (retryError) {
          throw retryError
        }
      } else {
        throw error
      }
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(fileName)

    console.log(`Uploaded media to Supabase: ${urlData.publicUrl}`)
    return urlData.publicUrl

  } catch (err) {
    console.error('Error uploading media to Supabase:', err.message)
    return null
  }
}

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
          const fromNumber = msg.key.remoteJid
          console.log(`Message received on session ${sessionId}: ${fromNumber}`)

          // Determine message type and extract content
          let messageText = ''
          let messageType = 'text'
          let mediaData = null

          const msgContent = msg.message

          if (!msgContent) {
            console.log('Skipping message with no content (system/sync message)')
            continue
          }

          // Handle different message types
          if (msgContent.conversation) {
            // Plain text message
            messageText = msgContent.conversation
            messageType = 'text'
          } else if (msgContent.extendedTextMessage?.text) {
            // Extended text (with formatting, links, etc.)
            messageText = msgContent.extendedTextMessage.text
            messageType = 'text'
          } else if (msgContent.imageMessage) {
            // Image message
            messageType = 'image'
            messageText = msgContent.imageMessage.caption || '[Image received]'
            console.log(`Image message received from ${fromNumber}`)

            // Download image and upload to Supabase Storage
            try {
              const buffer = await downloadMediaMessage(msg, 'buffer', {})
              const mimeType = msgContent.imageMessage.mimetype || 'image/jpeg'
              console.log(`Downloaded image: ${mimeType}, size: ${buffer.length} bytes`)

              // Upload to Supabase Storage and get public URL
              const imageUrl = await uploadMediaToStorage(buffer, mimeType, chatbotId, fromNumber)

              if (imageUrl) {
                mediaData = {
                  type: 'image',
                  mimeType: mimeType,
                  url: imageUrl,  // Public URL instead of base64
                  caption: msgContent.imageMessage.caption || ''
                }
                console.log(`Image uploaded successfully: ${imageUrl}`)
              } else {
                console.log('Failed to upload image, continuing without media URL')
              }
            } catch (downloadErr) {
              console.error('Error processing image:', downloadErr.message)
              // Continue without media data
            }
          } else if (msgContent.videoMessage) {
            // Video message
            messageType = 'video'
            messageText = msgContent.videoMessage.caption || '[Video received]'
            console.log(`Video message received from ${fromNumber}`)
          } else if (msgContent.audioMessage) {
            // Audio/voice message
            messageType = 'audio'
            messageText = '[Voice message received]'
            console.log(`Audio message received from ${fromNumber}`)
          } else if (msgContent.documentMessage) {
            // Document/file message
            messageType = 'document'
            messageText = msgContent.documentMessage.fileName || '[Document received]'
            console.log(`Document received from ${fromNumber}: ${messageText}`)
          } else if (msgContent.stickerMessage) {
            // Sticker message
            messageType = 'sticker'
            messageText = '[Sticker received]'
            console.log(`Sticker received from ${fromNumber}`)
          } else if (msgContent.locationMessage) {
            // Location message
            messageType = 'location'
            const lat = msgContent.locationMessage.degreesLatitude
            const lng = msgContent.locationMessage.degreesLongitude
            messageText = `[Location: ${lat}, ${lng}]`
            console.log(`Location received from ${fromNumber}: ${lat}, ${lng}`)
          } else if (msgContent.contactMessage || msgContent.contactsArrayMessage) {
            // Contact message
            messageType = 'contact'
            messageText = '[Contact shared]'
            console.log(`Contact received from ${fromNumber}`)
          } else {
            // Unknown or unsupported message type
            console.log('Skipping unsupported message type:', Object.keys(msgContent))
            continue
          }

          // Skip if still no content (shouldn't happen but safety check)
          if (!messageText || messageText.trim() === '') {
            console.log('Skipping empty message content')
            continue
          }

          console.log(`Processing ${messageType} message: "${messageText.substring(0, 50)}..."`)

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
              message_type: messageType,
              content: messageText,
              timestamp: new Date(msg.messageTimestamp * 1000).toISOString()
            })

          if (error) {
            console.error('Error storing message:', error)
          }

          // Process message with chatbot (pass media data if available)
          await processInboundMessage(sessionId, chatbotId, fromNumber, messageText, sock, messageType, mediaData)
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
 * Send WhatsApp image message
 * @param {object} sock - WhatsApp socket
 * @param {string} toNumber - Recipient number
 * @param {string} imageUrl - Image URL or base64 data
 * @param {string} caption - Optional caption for the image
 */
async function sendWhatsAppImage(sock, toNumber, imageUrl, caption = '') {
  try {
    console.log(`Sending image to ${toNumber}: ${imageUrl.substring(0, 100)}...`)

    // Show uploading indicator
    await sock.sendPresenceUpdate('composing', toNumber)
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Send image
    await sock.sendMessage(toNumber, {
      image: { url: imageUrl },
      caption: caption || undefined
    })

    // Clear presence
    await sock.sendPresenceUpdate('paused', toNumber)

    console.log('Image sent successfully')
  } catch (err) {
    console.error('Error sending WhatsApp image:', err)
    throw err
  }
}

/**
 * Send WhatsApp document message (PDF, DOCX, XLSX, etc.)
 * @param {object} sock - WhatsApp socket
 * @param {string} toNumber - Recipient number
 * @param {string} documentUrl - Document URL
 * @param {string} fileName - File name with extension (e.g., "Product Catalog.pdf")
 * @param {string} caption - Optional caption for the document
 */
async function sendWhatsAppDocument(sock, toNumber, documentUrl, fileName, caption = '') {
  try {
    console.log(`Sending document to ${toNumber}: ${fileName}`)

    // Show uploading indicator
    await sock.sendPresenceUpdate('composing', toNumber)
    await new Promise(resolve => setTimeout(resolve, 1500))

    // Determine mimetype from file extension
    const extension = fileName.split('.').pop().toLowerCase()
    const mimeTypes = {
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'ppt': 'application/vnd.ms-powerpoint',
      'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'txt': 'text/plain',
      'csv': 'text/csv',
      'zip': 'application/zip',
      'rar': 'application/x-rar-compressed'
    }

    const mimetype = mimeTypes[extension] || 'application/octet-stream'

    // Send document
    await sock.sendMessage(toNumber, {
      document: { url: documentUrl },
      fileName: fileName,
      mimetype: mimetype,
      caption: caption || undefined
    })

    // Clear presence
    await sock.sendPresenceUpdate('paused', toNumber)

    console.log(`Document sent successfully: ${fileName}`)
  } catch (err) {
    console.error('Error sending WhatsApp document:', err)
    throw err
  }
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
 * Process batched messages (combine and send to n8n)
 */
async function processBatchedMessages(sessionId, chatbotId, fromNumber, messages, sock) {
  // Combine all messages with line breaks
  const combinedMessage = messages.join('\n')
  console.log(`Processing ${messages.length} batched messages as: "${combinedMessage}"`)

  // Process as single message
  await processMessageWithChatbot(sessionId, chatbotId, fromNumber, combinedMessage, sock)
}

/**
 * Process inbound message with batching support
 */
async function processInboundMessage(sessionId, chatbotId, fromNumber, messageText, sock, messageType = 'text', mediaData = null) {
  try {
    // Get chatbot settings to check batch timeout
    const { data: chatbot } = await supabase
      .from('avatars')
      .select('whatsapp_message_batch_timeout')
      .eq('id', chatbotId)
      .single()

    if (!chatbot) {
      console.error('Chatbot not found:', chatbotId)
      return
    }

    const batchTimeout = chatbot.whatsapp_message_batch_timeout || 0

    // If batching is disabled (timeout = 0), process immediately
    if (batchTimeout === 0) {
      await processMessageWithChatbot(sessionId, chatbotId, fromNumber, messageText, sock, messageType, mediaData)
      return
    }

    // Batching is enabled - add to buffer
    const bufferKey = `${sessionId}_${fromNumber}`

    if (messageBatchBuffers.has(bufferKey)) {
      // Add to existing buffer
      const buffer = messageBatchBuffers.get(bufferKey)
      buffer.messages.push({ text: messageText, type: messageType, media: mediaData })
      console.log(`Added message to batch buffer (${buffer.messages.length} messages, ${batchTimeout}s timeout)`)

      // Clear existing timer and restart
      clearTimeout(buffer.timer)
      buffer.timer = setTimeout(async () => {
        const messages = buffer.messages
        messageBatchBuffers.delete(bufferKey)
        await processBatchedMessages(sessionId, chatbotId, fromNumber, messages, sock)
      }, batchTimeout * 1000)
    } else {
      // Create new buffer
      const timer = setTimeout(async () => {
        const buffer = messageBatchBuffers.get(bufferKey)
        if (buffer) {
          const messages = buffer.messages
          messageBatchBuffers.delete(bufferKey)
          await processBatchedMessages(sessionId, chatbotId, fromNumber, messages, sock)
        }
      }, batchTimeout * 1000)

      messageBatchBuffers.set(bufferKey, {
        messages: [{ text: messageText, type: messageType, media: mediaData }],
        timer,
        chatbotId
      })
      console.log(`Started batch buffer (${batchTimeout}s timeout)`)
    }
  } catch (err) {
    console.error('Error in processInboundMessage:', err)
  }
}

/**
 * Process message with chatbot (n8n integration)
 */
async function processMessageWithChatbot(sessionId, chatbotId, fromNumber, messageText, sock, messageType = 'text', mediaData = null) {
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
    let images = []
    let documents = []

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
          message_type: messageType,
          from_number: fromNumber,

          // Media data (for images, documents, etc.)
          media: mediaData ? {
            type: mediaData.type,
            mime_type: mediaData.mimeType,
            url: mediaData.url,  // Public URL from Supabase Storage
            caption: mediaData.caption
          } : null,

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
      let data = Array.isArray(result) ? result[0] : result

      // Check if the data is a JSON string and parse it
      if (typeof data === 'string') {
        try {
          console.log('Response is a string, attempting to parse as JSON...')
          data = JSON.parse(data)
        } catch (e) {
          console.log('Failed to parse as JSON, using raw string')
        }
      }

      // Extract reply - could be in reply, response, message, output, or text field
      reply = data?.reply || data?.response || data?.message || data?.output || data?.text

      // If reply is still undefined but data is a string, use the string directly
      if (!reply && typeof data === 'string') {
        reply = data
      }

      console.log('Extracted reply:', reply)

      if (!reply) {
        console.error('Warning: No reply found in n8n response. Full response:', result)
        reply = 'Sorry, I could not generate a response.'
      }

      // Extract images if present (new feature)
      images = data?.images || []
      if (images.length > 0) {
        console.log(`n8n response includes ${images.length} image(s)`)
      }

      // Extract documents if present (new feature)
      documents = data?.documents || []
      if (documents.length > 0) {
        console.log(`n8n response includes ${documents.length} document(s)`)
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
          message_type: messageType,
          avatar_id: chatbotId,
          user_identifier: fromNumber,
          // Include media data for images
          media: mediaData ? {
            type: mediaData.type,
            mime_type: mediaData.mimeType,
            url: mediaData.url,  // Public URL from Supabase Storage
            caption: mediaData.caption
          } : null
        })
      })

      if (!response.ok) {
        console.error('Error calling avatar-chat:', await response.text())
        return
      }

      const result = await response.json()
      reply = result.reply
      images = [] // Edge function doesn't support images yet
      documents = [] // Edge function doesn't support documents yet
    }

    // Get WhatsApp settings from chatbot configuration
    const messageDelimiter = chatbot.whatsapp_message_delimiter || null
    const typingWPM = chatbot.whatsapp_typing_wpm || 200
    const enableImages = chatbot.whatsapp_enable_images !== false // Default to true

    console.log(`WhatsApp settings - Delimiter: ${messageDelimiter || 'auto'}, Typing speed: ${typingWPM} WPM, Images: ${enableImages ? 'enabled' : 'disabled'}`)

    // Send reply via WhatsApp with typing indicator and message splitting
    const sentChunks = await sendWhatsAppMessage(sock, fromNumber, reply, messageDelimiter, typingWPM)

    // Send images if enabled and images are present
    if (enableImages && images && images.length > 0) {
      console.log(`Sending ${images.length} image(s)...`)
      for (const imageData of images) {
        try {
          // imageData can be a string (URL) or object with {url, caption}
          const imageUrl = typeof imageData === 'string' ? imageData : imageData.url
          const caption = typeof imageData === 'object' ? imageData.caption : ''

          await sendWhatsAppImage(sock, fromNumber, imageUrl, caption)

          // Store image message in database
          const sessionUuid = await getSessionIdFromDb(sessionId)
          await supabase
            .from('whatsapp_web_messages')
            .insert({
              session_id: sessionUuid,
              chatbot_id: chatbotId,
              message_id: `out_img_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
              from_number: sock.user?.id || '',
              to_number: fromNumber,
              direction: 'outbound',
              message_type: 'image',
              content: imageUrl,
              timestamp: new Date().toISOString()
            })
        } catch (imgErr) {
          console.error('Error sending image:', imgErr)
        }
      }
    }

    // Send documents if present (PDF, DOCX, etc.)
    if (documents && documents.length > 0) {
      console.log(`Sending ${documents.length} document(s)...`)
      for (const docData of documents) {
        try {
          const fileName = docData.fileName || docData.filename || 'document.pdf'
          const caption = docData.caption || ''
          let documentUrl = docData.url

          // If filePath is provided instead of URL, generate signed URL
          if (docData.filePath && !documentUrl) {
            console.log(`Generating signed URL for file: ${docData.filePath}`)
            const { data: signedUrlData, error: signedError } = await supabase.storage
              .from('knowledge-base')
              .createSignedUrl(docData.filePath, 3600) // 1 hour expiry

            if (signedError) {
              console.error('Error generating signed URL:', signedError)
              throw new Error(`Failed to generate URL for ${fileName}: ${signedError.message}`)
            }

            documentUrl = signedUrlData.signedUrl
            console.log(`Signed URL generated successfully`)
          }

          if (!documentUrl) {
            throw new Error(`No URL or filePath provided for document: ${fileName}`)
          }

          await sendWhatsAppDocument(sock, fromNumber, documentUrl, fileName, caption)

          // Store document message in database
          const sessionUuid = await getSessionIdFromDb(sessionId)
          await supabase
            .from('whatsapp_web_messages')
            .insert({
              session_id: sessionUuid,
              chatbot_id: chatbotId,
              message_id: `out_doc_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
              from_number: sock.user?.id || '',
              to_number: fromNumber,
              direction: 'outbound',
              message_type: 'document',
              content: `${fileName}: ${docData.filePath || documentUrl}`,
              timestamp: new Date().toISOString()
            })
        } catch (docErr) {
          console.error('Error sending document:', docErr)
        }
      }
    }

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
