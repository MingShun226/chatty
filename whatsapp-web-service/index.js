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
 * Sync message to n8n Postgres Chat Memory format
 * Uses a SINGLE shared table (n8n_chat_history) for ALL chatbots
 * Session key format: {chatbotId}_{phoneNumber} to separate conversations
 *
 * @param {string} chatbotId - UUID of the chatbot
 * @param {string} phoneNumber - Phone number
 * @param {string} role - 'user' or 'assistant'
 * @param {string} content - Message content
 */
async function syncToN8nChatHistory(chatbotId, phoneNumber, role, content) {
  try {
    // Clean phone number
    const cleanPhone = phoneNumber.replace('@s.whatsapp.net', '').replace('@lid', '').replace(/[^0-9]/g, '')

    // Session key combines chatbot ID and phone for unique conversations
    // Format: {chatbotId}_{phoneNumber}
    const sessionKey = `${chatbotId}_${cleanPhone}`

    // n8n Postgres Chat Memory format
    const messageData = {
      type: role === 'user' ? 'human' : 'ai',
      data: { content: content }
    }

    // Insert into shared n8n chat history table
    const { error } = await supabase
      .from('n8n_chat_history')
      .insert({
        session_id: sessionKey,
        message: messageData
      })

    if (error) {
      // Table might not exist yet - log only if it's not a "table doesn't exist" error
      if (error.code !== '42P01') {
        console.error('Error syncing to n8n chat history:', error.message)
      }
    }
  } catch (err) {
    // Non-critical - don't fail the main operation
    console.error('Error in syncToN8nChatHistory:', err.message)
  }
}

/**
 * Upload media (image/video/document) to Supabase Storage
 * Returns the public URL of the uploaded file
 */
async function uploadMediaToStorage(buffer, mimeType, chatbotId, fromNumber) {
  try {
    // Determine file extension from mime type
    const extensions = {
      // Images
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      // Videos
      'video/mp4': 'mp4',
      'video/3gpp': '3gp',
      'video/quicktime': 'mov',
      // Audio
      'audio/ogg': 'ogg',
      'audio/ogg; codecs=opus': 'ogg',
      'audio/mpeg': 'mp3',
      'audio/mp4': 'm4a',
      'audio/aac': 'aac',
      'audio/wav': 'wav',
      // Documents
      'application/pdf': 'pdf',
      'application/msword': 'doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'application/vnd.ms-excel': 'xls',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
      'application/vnd.ms-powerpoint': 'ppt',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
      'text/plain': 'txt',
      'text/csv': 'csv',
      'application/zip': 'zip',
      'application/octet-stream': 'bin'
    }
    // Handle mime types with parameters (e.g., "audio/ogg; codecs=opus")
    // Supabase doesn't accept mime types with parameters, so we use the base type
    const baseMimeType = mimeType.split(';')[0].trim()
    const ext = extensions[mimeType] || extensions[baseMimeType] || 'bin'

    // Create unique filename
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2, 8)
    const cleanNumber = fromNumber.replace('@s.whatsapp.net', '').replace('@lid', '').replace(/[^0-9]/g, '')
    const fileName = `${cleanNumber}/${timestamp}_${randomId}.${ext}`
    const bucketName = 'whatsapp-media'

    console.log(`Uploading to Supabase: ${fileName}, mime: ${baseMimeType}, size: ${buffer.length} bytes`)

    // Upload to Supabase Storage (use baseMimeType without parameters)
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(fileName, buffer, {
        contentType: baseMimeType,  // Use base mime type without codec parameters
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
            contentType: baseMimeType,  // Use base mime type without codec parameters
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
          let fromNumber = msg.key.remoteJid

          // Handle Linked ID (LID) format - WhatsApp's new privacy format
          // LID format: 123456789@lid (not a real phone number)
          // Try to get actual phone number from participant or message metadata
          if (fromNumber?.endsWith('@lid')) {
            console.log(`[LID DEBUG] =====================`)
            console.log(`[LID DEBUG] LID detected: ${fromNumber}`)
            console.log(`[LID DEBUG] Message key:`, JSON.stringify(msg.key, null, 2))
            console.log(`[LID DEBUG] Push name: ${msg.pushName || 'N/A'}`)
            console.log(`[LID DEBUG] Verified biz name: ${msg.verifiedBizName || 'N/A'}`)

            // Try to get actual phone number from participant field
            const participant = msg.key.participant
            if (participant && !participant.endsWith('@lid')) {
              console.log(`[LID DEBUG] Found participant phone: ${participant}`)
              fromNumber = participant
            } else {
              // Try to get phone from the message's deviceSentMeta or other fields
              const deviceSentMeta = msg.message?.deviceSentMessage?.message
              console.log(`[LID DEBUG] Device sent meta available: ${!!deviceSentMeta}`)

              // Check if sock has lidToJid mapping (some Baileys versions support this)
              try {
                if (sock.store?.contacts) {
                  const contact = sock.store.contacts[fromNumber]
                  console.log(`[LID DEBUG] Contact from store:`, contact ? JSON.stringify(contact) : 'Not found')
                }
              } catch (e) {
                console.log(`[LID DEBUG] Could not access store contacts`)
              }

              console.log(`[LID DEBUG] Using LID as identifier (actual phone number not available)`)
              console.log(`[LID DEBUG] =====================`)
            }
          }

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

            // Download video and upload to Supabase Storage
            try {
              const buffer = await downloadMediaMessage(msg, 'buffer', {})
              const mimeType = msgContent.videoMessage.mimetype || 'video/mp4'
              console.log(`Downloaded video: ${mimeType}, size: ${buffer.length} bytes`)

              // Upload to Supabase Storage and get public URL
              const videoUrl = await uploadMediaToStorage(buffer, mimeType, chatbotId, fromNumber)

              if (videoUrl) {
                mediaData = {
                  type: 'video',
                  mimeType: mimeType,
                  url: videoUrl,
                  caption: msgContent.videoMessage.caption || '',
                  duration: msgContent.videoMessage.seconds || null
                }
                console.log(`Video uploaded successfully: ${videoUrl}`)
              }
            } catch (downloadErr) {
              console.error('Error processing video:', downloadErr.message)
            }
          } else if (msgContent.audioMessage) {
            // Audio/voice message
            messageType = 'audio'
            const isVoiceNote = msgContent.audioMessage.ptt === true // ptt = push to talk (voice note)
            messageText = isVoiceNote ? '[Voice message received]' : '[Audio received]'
            const mimeType = msgContent.audioMessage.mimetype || 'audio/ogg; codecs=opus'
            console.log(`Audio message received from ${fromNumber} (voice note: ${isVoiceNote}, mime: ${mimeType})`)
            console.log(`Audio message details:`, JSON.stringify({
              ptt: msgContent.audioMessage.ptt,
              seconds: msgContent.audioMessage.seconds,
              mimetype: msgContent.audioMessage.mimetype,
              fileLength: msgContent.audioMessage.fileLength,
              url: msgContent.audioMessage.url ? 'present' : 'missing',
              mediaKey: msgContent.audioMessage.mediaKey ? 'present' : 'missing'
            }))

            // Download audio and upload to Supabase Storage
            try {
              console.log('Attempting to download audio message...')

              // For voice notes, we need to use stream type and convert to buffer
              const stream = await downloadMediaMessage(
                msg,
                'stream',
                {},
                {
                  reuploadRequest: sock.updateMediaMessage
                }
              )

              // Convert stream to buffer
              const chunks = []
              for await (const chunk of stream) {
                chunks.push(chunk)
              }
              const buffer = Buffer.concat(chunks)

              console.log(`Downloaded audio: ${mimeType}, size: ${buffer.length} bytes`)

              if (buffer.length > 0) {
                // Upload to Supabase Storage and get public URL
                const audioUrl = await uploadMediaToStorage(buffer, mimeType, chatbotId, fromNumber)

                if (audioUrl) {
                  mediaData = {
                    type: 'audio',
                    mimeType: mimeType,
                    url: audioUrl,
                    isVoiceNote: isVoiceNote,
                    duration: msgContent.audioMessage.seconds || null
                  }
                  console.log(`Audio uploaded successfully: ${audioUrl}`)
                }
              } else {
                console.error('Audio download returned empty buffer')
              }
            } catch (downloadErr) {
              console.error('Error processing audio:', downloadErr.message)
              console.error('Full error:', downloadErr)
            }
          } else if (msgContent.documentMessage) {
            // Document/file message (PDF, DOCX, etc.)
            messageType = 'document'
            const fileName = msgContent.documentMessage.fileName || 'document'
            messageText = fileName
            console.log(`Document received from ${fromNumber}: ${fileName}`)

            // Download document and upload to Supabase Storage
            try {
              const buffer = await downloadMediaMessage(msg, 'buffer', {})
              const mimeType = msgContent.documentMessage.mimetype || 'application/octet-stream'
              console.log(`Downloaded document: ${mimeType}, size: ${buffer.length} bytes`)

              // Upload to Supabase Storage and get public URL
              const documentUrl = await uploadMediaToStorage(buffer, mimeType, chatbotId, fromNumber)

              if (documentUrl) {
                mediaData = {
                  type: 'document',
                  mimeType: mimeType,
                  url: documentUrl,
                  fileName: fileName,
                  fileSize: buffer.length
                }
                console.log(`Document uploaded successfully: ${documentUrl}`)
              }
            } catch (downloadErr) {
              console.error('Error processing document:', downloadErr.message)
            }
          } else if (msgContent.stickerMessage) {
            // Sticker message - ignore and don't send to webhook
            console.log(`Sticker received from ${fromNumber} - ignoring`)
            continue
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

          // Sync to n8n chat history (shared table for all chatbots)
          await syncToN8nChatHistory(chatbotId, fromNumber, 'user', messageText)

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
  // Messages are objects with { text, type, media } structure
  // Extract text from each message and combine with line breaks
  const combinedMessage = messages.map(m => m.text).join('\n')
  console.log(`Processing ${messages.length} batched messages as: "${combinedMessage}"`)

  // Get the last message's type and media (for context)
  const lastMessage = messages[messages.length - 1]
  const messageType = lastMessage?.type || 'text'
  const mediaData = lastMessage?.media || null

  // Process as single message with the last message's media context
  await processMessageWithChatbot(sessionId, chatbotId, fromNumber, combinedMessage, sock, messageType, mediaData)
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
    // Get userId from socket data (for AI tagging)
    const socketData = whatsappSockets.get(sessionId)
    const userId = socketData?.userId

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

    // Clean phone number for database lookup
    const cleanPhoneForLookup = fromNumber.replace(/[^0-9]/g, '')

    // Check if AI is paused for this contact (human takeover mode)
    const { data: contactProfile } = await supabase
      .from('contact_profiles')
      .select('ai_paused, ai_paused_reason')
      .eq('chatbot_id', chatbotId)
      .eq('phone_number', cleanPhoneForLookup)
      .single()

    if (contactProfile?.ai_paused) {
      console.log(`AI paused for contact ${fromNumber} (${contactProfile.ai_paused_reason || 'Human takeover'}). Skipping AI response.`)
      // Still save the message to conversation history but don't generate AI response
      await supabase.from('avatar_conversations').insert({
        avatar_id: chatbotId,
        user_id: userId,
        phone_number: cleanPhoneForLookup,
        role: 'user',
        content: messageText,
        created_at: new Date().toISOString()
      })
      return // Skip AI response
    }

    // Get active prompt version (from Prompt Engineer page)
    const { data: activePromptVersion } = await supabase
      .from('avatar_prompt_versions')
      .select('*')
      .eq('avatar_id', chatbotId)
      .eq('is_active', true)
      .order('version_number', { ascending: false })
      .limit(1)
      .single()

    if (activePromptVersion) {
      console.log(`Using active prompt version: v${activePromptVersion.version_number} for chatbot ${chatbotId}`)
    } else {
      console.log(`No active prompt version found for chatbot ${chatbotId}, using default avatar settings`)
    }

    // NOTE: Products, knowledge base, and conversation history are NOT sent in webhook anymore
    // The AI agent should fetch these on-demand via the chatbot-data API endpoints
    // This reduces webhook payload size and improves performance

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

          // Media data (for images, videos, audio, documents)
          media: mediaData ? {
            type: mediaData.type,
            mime_type: mediaData.mimeType,
            url: mediaData.url,  // Public URL from Supabase Storage
            caption: mediaData.caption || null,
            // Document-specific fields
            file_name: mediaData.fileName || null,
            file_size: mediaData.fileSize || null,
            // Audio/Video-specific fields
            duration: mediaData.duration || null,
            is_voice_note: mediaData.isVoiceNote || false
          } : null,

          // Chatbot configuration (using active prompt version if available)
          chatbot: {
            id: chatbot.id,
            name: chatbot.name,
            company_name: chatbot.company_name,
            industry: chatbot.industry,
            // Use active prompt version's system_prompt, fallback to avatar's default
            system_prompt: activePromptVersion?.system_prompt || chatbot.system_prompt,
            business_context: activePromptVersion?.business_context || chatbot.business_context,
            compliance_rules: activePromptVersion?.compliance_rules || chatbot.compliance_rules,
            response_guidelines: activePromptVersion?.response_guidelines || chatbot.response_guidelines,
            // Include additional prompt version fields if available
            personality_traits: activePromptVersion?.personality_traits || chatbot.personality_traits,
            behavior_rules: activePromptVersion?.behavior_rules || null,
            prompt_version: activePromptVersion ? `v${activePromptVersion.version_number}` : null,
            // Pricing visibility setting - when false, AI should not reveal prices
            price_visible: chatbot.price_visible !== false // Default to true if not set
          },

          // API endpoints for fetching data on-demand (use HTTP tool in AI agent)
          // These require x-api-key header with your platform API key
          api: {
            base_url: 'https://xatrtqdgghanwdujyhkq.supabase.co/functions/v1',
            chatbot_id: chatbotId,
            endpoints: {
              // Search/list products
              products: `/chatbot-data?type=products&chatbot_id=${chatbotId}&query={search_term}&limit=20`,
              // Get product categories
              categories: `/chatbot-data?type=categories&chatbot_id=${chatbotId}`,
              // Get active promotions
              promotions: `/chatbot-data?type=promotions&chatbot_id=${chatbotId}`,
              // Validate promo code
              validate_promo: `/chatbot-data?type=validate_promo&chatbot_id=${chatbotId}&promo_code={code}`,
              // Search knowledge base
              knowledge: `/chatbot-data?type=knowledge&chatbot_id=${chatbotId}&query={search_term}`,
              // Get conversation history
              conversations: `/avatar-conversations?avatar_id=${chatbotId}&phone_number=${encodeURIComponent(fromNumber)}`
            },
            headers_required: [
              'Authorization: Bearer {supabase_anon_key}',
              'x-api-key: {your_platform_api_key}'
            ]
          }
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
          // Include media data for images, videos, audio, documents
          media: mediaData ? {
            type: mediaData.type,
            mime_type: mediaData.mimeType,
            url: mediaData.url,  // Public URL from Supabase Storage
            caption: mediaData.caption || null,
            file_name: mediaData.fileName || null,
            file_size: mediaData.fileSize || null,
            duration: mediaData.duration || null,
            is_voice_note: mediaData.isVoiceNote || false
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

    // Sync bot reply to n8n chat history (shared table for all chatbots)
    const fullReply = sentChunks.join('\n')
    await syncToN8nChatHistory(chatbotId, fromNumber, 'assistant', fullReply)

    // Analyze and tag contact for smart follow-ups (async, don't wait)
    analyzeAndTagContact(chatbotId, fromNumber, userId, sessionId)
      .catch(err => console.error('Error in background tagging:', err))

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
// SMART FOLLOW-UP SYSTEM WITH AI TAGGING
// ====================================================

/**
 * Send WhatsApp notification to admin when high-priority intent is detected
 * @param {string} chatbotId - UUID of the chatbot
 * @param {string} sessionId - WhatsApp session ID
 * @param {string} customerPhone - Customer's phone number
 * @param {object} analysis - AI analysis result
 */
async function sendAdminNotification(chatbotId, sessionId, customerPhone, analysis) {
  try {
    // Get notification settings for this chatbot
    const { data: settings } = await supabase
      .from('followup_settings')
      .select('notification_enabled, notification_phone_number, notify_on_purchase_intent, notify_on_wants_human, notify_on_price_inquiry, notify_on_ai_unsure, auto_pause_on_notification')
      .eq('chatbot_id', chatbotId)
      .single()

    if (!settings?.notification_enabled || !settings?.notification_phone_number) {
      return // Notifications not enabled or no phone configured
    }

    // Check if we should notify for each intent type
    const shouldNotifyPurchase = settings.notify_on_purchase_intent && analysis.wantsToBuy
    const shouldNotifyHuman = settings.notify_on_wants_human && analysis.wantsHumanAgent
    const shouldNotifyPrice = settings.notify_on_price_inquiry && analysis.asksAboutPrice
    const shouldNotifyUnsure = settings.notify_on_ai_unsure && analysis.aiUnsure

    if (!shouldNotifyPurchase && !shouldNotifyHuman && !shouldNotifyPrice && !shouldNotifyUnsure) {
      return // No matching trigger
    }

    // Get chatbot name for the notification
    const { data: chatbot } = await supabase
      .from('avatars')
      .select('name')
      .eq('id', chatbotId)
      .single()

    const chatbotName = chatbot?.name || 'Chatbot'

    // Build notification message with all detected intents
    const alertTypes = []
    if (shouldNotifyPurchase) alertTypes.push('🛒 wants to BUY')
    if (shouldNotifyHuman) alertTypes.push('👤 wants HUMAN AGENT')
    if (shouldNotifyPrice) alertTypes.push('💰 asking about PRICE')
    if (shouldNotifyUnsure) alertTypes.push('❓ AI NEEDS HELP')

    const alertType = alertTypes.join('\n')

    // Check if auto-pause is enabled
    let autoPauseNote = ''
    if (settings.auto_pause_on_notification) {
      // Pause AI for this contact
      const cleanPhone = customerPhone.replace(/[^0-9]/g, '')
      await supabase
        .from('contact_profiles')
        .update({
          ai_paused: true,
          ai_paused_at: new Date().toISOString(),
          ai_paused_reason: 'Auto-paused on notification'
        })
        .eq('chatbot_id', chatbotId)
        .eq('phone_number', cleanPhone)

      autoPauseNote = '\n\n⏸️ *AI auto-paused* - You are now in control'
      console.log(`AI auto-paused for contact ${customerPhone}`)
    }

    const notificationMessage = `🔔 *${chatbotName} Alert*

Customer: ${customerPhone}
Intent:
${alertType}

Summary: ${analysis.summary || 'No summary available'}${autoPauseNote}

Reply to this customer now!`

    // Get the WhatsApp socket for this session
    const sessionData = whatsappSockets.get(sessionId)
    const sock = sessionData?.sock
    if (!sock) {
      console.error('No active session to send admin notification')
      return
    }

    // Format admin phone number for WhatsApp (add @s.whatsapp.net suffix)
    const adminPhone = settings.notification_phone_number.replace(/[^0-9]/g, '')
    const adminJid = adminPhone + '@s.whatsapp.net'

    // Send WhatsApp message to admin
    await sock.sendMessage(adminJid, { text: notificationMessage })

    console.log(`Admin notification sent to ${settings.notification_phone_number} for customer ${customerPhone}`)

  } catch (err) {
    console.error('Error sending admin notification:', err.message)
  }
}

/**
 * Analyze conversation and update contact profile with AI-assigned tags
 * Called after each message exchange
 */
async function analyzeAndTagContact(chatbotId, phoneNumber, userId, sessionId) {
  try {
    // Clean phone number - remove @s.whatsapp.net suffix if present
    const cleanPhoneNumber = phoneNumber.replace('@s.whatsapp.net', '').replace('@lid', '').replace(/[^0-9]/g, '')
    console.log(`Analyzing contact for tagging: ${phoneNumber} (cleaned: ${cleanPhoneNumber})`)

    // Check if auto-tagging is enabled for this chatbot
    let { data: settings, error: settingsError } = await supabase
      .from('followup_settings')
      .select('*')
      .eq('chatbot_id', chatbotId)
      .maybeSingle()

    // If settings table doesn't exist, skip silently (migration not run yet)
    if (settingsError && settingsError.code === '42P01') {
      console.log('Follow-up tables not found - migration may not be run yet')
      return
    }

    // Auto-create settings if they don't exist (default to enabled)
    if (!settings && userId) {
      console.log('Creating default follow-up settings for chatbot:', chatbotId)
      const { data: newSettings, error: createError } = await supabase
        .from('followup_settings')
        .insert({
          chatbot_id: chatbotId,
          user_id: userId,
          auto_tagging_enabled: true,
          auto_followup_enabled: true,
          business_hours_only: true,
          start_hour: 9,
          end_hour: 21,
          max_followups_per_contact: 3,
          ai_model: 'gpt-4o-mini'
        })
        .select()
        .single()

      if (createError) {
        console.log('Could not create settings:', createError.message)
        return
      }
      settings = newSettings

      // Also initialize default tags
      try {
        await supabase.rpc('initialize_default_tags', {
          p_chatbot_id: chatbotId,
          p_user_id: userId
        })
        console.log('Default tags initialized for chatbot:', chatbotId)
      } catch (tagError) {
        console.log('Could not initialize default tags:', tagError.message)
      }
    }

    // If auto-tagging is disabled, skip
    if (!settings?.auto_tagging_enabled) {
      console.log('Auto-tagging disabled for this chatbot')
      return
    }

    // Fetch existing contact profile to check previous intents (for notification deduplication)
    const { data: existingContact } = await supabase
      .from('contact_profiles')
      .select('ai_analysis')
      .eq('chatbot_id', chatbotId)
      .eq('phone_number', cleanPhoneNumber)
      .single()

    const previousAnalysis = existingContact?.ai_analysis || {}

    // Get last 40 messages for analysis (inbound + outbound combined)
    // Read from whatsapp_web_messages table where messages are actually stored
    const { data: messages, error: messagesError } = await supabase
      .from('whatsapp_web_messages')
      .select('content, direction, timestamp, from_number')
      .eq('chatbot_id', chatbotId)
      .eq('from_number', phoneNumber)  // Use original format with @s.whatsapp.net for matching
      .order('timestamp', { ascending: false })
      .limit(40)

    // Also check with cleaned phone number format
    let allMessages = messages || []
    if (allMessages.length === 0) {
      const { data: cleanedMessages } = await supabase
        .from('whatsapp_web_messages')
        .select('content, direction, timestamp, from_number, to_number')
        .eq('chatbot_id', chatbotId)
        .or(`from_number.eq.${phoneNumber},to_number.eq.${phoneNumber}`)
        .order('timestamp', { ascending: false })
        .limit(40)
      allMessages = cleanedMessages || []
    }

    if (!allMessages || allMessages.length < 1) {
      console.log('Not enough messages for analysis (checked whatsapp_web_messages)')
      return
    }

    console.log(`Found ${allMessages.length} messages for analysis`)

    // Reverse to chronological order
    const chronologicalMessages = allMessages.reverse()

    // Build conversation text from inbound (user) and outbound (assistant) messages
    const conversationText = chronologicalMessages
      .map(m => {
        const content = m.content || ''
        if (m.direction === 'inbound') {
          return `Customer: ${content}`
        } else if (m.direction === 'outbound') {
          return `Assistant: ${content}`
        }
        return ''
      })
      .filter(line => line !== '')
      .join('\n')

    // Get available tags for this chatbot
    const { data: availableTags } = await supabase
      .from('followup_tags')
      .select('tag_name, description, auto_followup, followup_delay_hours')
      .eq('chatbot_id', chatbotId)

    const tagDescriptions = (availableTags || [])
      .map(t => `- ${t.tag_name}: ${t.description}`)
      .join('\n')

    // Call OpenAI for analysis (using the AI model configured in settings)
    const aiModel = settings.ai_model || 'gpt-4o-mini'
    const analysisPrompt = `Analyze this WhatsApp conversation and categorize the contact.

CONVERSATION:
${conversationText}

Available tags to choose from:
${tagDescriptions || `- hot_lead: High interest, likely to convert (asking about prices, features, availability)
- new_lead: First-time inquiry, just getting information
- customer: Already purchased or existing customer
- needs_help: Has questions or issues to resolve
- inactive: Conversation went cold, no recent engagement`}

SPECIAL DETECTION RULES (check the LATEST customer messages carefully):
- wantsToBuy = true if customer explicitly wants to purchase NOW: "I want to buy", "how to order", "ready to purchase", "take my order", "checkout", "I'll buy it", "I want to order", "how do I pay"
- wantsHumanAgent = true if customer requested human support: "speak to human", "talk to agent", "real person", "customer service", "live support", "speak to someone", "talk to real", "human please", "actual person"
- asksAboutPrice = true if customer asks about pricing, cost, or rates: "how much", "what's the price", "berapa harga", "price", "cost", "fee", "rate", "pricing", "budget", "quotation", "quote"
- aiUnsure = true if the assistant's last response seemed uncertain, deflected the question, couldn't provide a clear answer, or if the customer's question is unusual/off-topic that the bot might not handle well

Analyze and respond ONLY with valid JSON (no markdown, no explanation):
{
  "tags": ["tag1", "tag2"],
  "primaryTag": "most_relevant_tag",
  "sentiment": "positive" | "neutral" | "negative",
  "summary": "Brief 1-2 sentence summary of conversation state",
  "shouldAutoFollowUp": true/false,
  "suggestedFollowUp": "Natural follow-up message if applicable",
  "confidence": 0.0-1.0,
  "wantsToBuy": true/false,
  "wantsHumanAgent": true/false,
  "asksAboutPrice": true/false,
  "aiUnsure": true/false
}`

    // Use OpenAI API directly (or could use an edge function)
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY
    if (!OPENAI_API_KEY) {
      console.log('OpenAI API key not configured, skipping AI analysis')
      return
    }

    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: aiModel,
        messages: [
          { role: 'system', content: 'You are a customer analysis AI. Analyze conversations and respond with JSON only.' },
          { role: 'user', content: analysisPrompt }
        ],
        temperature: 0.3,
        max_tokens: 500
      })
    })

    if (!aiResponse.ok) {
      console.error('OpenAI API error:', await aiResponse.text())
      return
    }

    const aiResult = await aiResponse.json()
    let analysis
    try {
      const content = aiResult.choices[0].message.content
      // Clean up any markdown formatting
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      analysis = JSON.parse(cleanContent)
    } catch (parseErr) {
      console.error('Error parsing AI response:', parseErr)
      return
    }

    console.log('AI Analysis result:', analysis)

    // Calculate follow-up due time based on primary tag
    let followupDueAt = null
    if (analysis.shouldAutoFollowUp && analysis.primaryTag) {
      const tagConfig = availableTags?.find(t => t.tag_name === analysis.primaryTag)
      if (tagConfig?.auto_followup) {
        const delayHours = tagConfig.followup_delay_hours || 24
        followupDueAt = new Date(Date.now() + delayHours * 60 * 60 * 1000).toISOString()
        console.log(`Follow-up scheduled for ${delayHours}h from now: ${followupDueAt}`)
      }
    }

    // Get current message count from whatsapp_web_messages
    const { count: messageCount } = await supabase
      .from('whatsapp_web_messages')
      .select('*', { count: 'exact', head: true })
      .eq('chatbot_id', chatbotId)
      .or(`from_number.eq.${phoneNumber},to_number.eq.${phoneNumber}`)

    // Upsert contact profile (store cleaned phone number for consistency)
    const { error: upsertError } = await supabase
      .from('contact_profiles')
      .upsert({
        chatbot_id: chatbotId,
        phone_number: cleanPhoneNumber,
        user_id: userId,
        session_id: sessionId,
        tags: analysis.tags || [],
        primary_tag: analysis.primaryTag,
        last_message_at: new Date().toISOString(),
        last_message_role: 'user',
        message_count: messageCount || 0,
        ai_summary: analysis.summary,
        ai_sentiment: analysis.sentiment,
        ai_analysis: analysis,
        analyzed_at: new Date().toISOString(),
        followup_due_at: followupDueAt,
        // Reset followup count if user replied (new conversation thread)
        followup_count: 0
      }, { onConflict: 'chatbot_id,phone_number' })

    if (upsertError) {
      console.error('Error upserting contact profile:', upsertError)
    } else {
      console.log(`Contact profile updated with tags: ${analysis.tags?.join(', ')}`)

      // Send admin notification only if this is a NEW high-priority intent
      // (not already flagged in previous analysis to avoid duplicate notifications)
      const isNewBuyIntent = analysis.wantsToBuy && !previousAnalysis.wantsToBuy
      const isNewHumanIntent = analysis.wantsHumanAgent && !previousAnalysis.wantsHumanAgent
      const isNewPriceIntent = analysis.asksAboutPrice && !previousAnalysis.asksAboutPrice
      const isNewUnsureIntent = analysis.aiUnsure && !previousAnalysis.aiUnsure

      if (isNewBuyIntent || isNewHumanIntent || isNewPriceIntent || isNewUnsureIntent) {
        console.log(`NEW intent detected - wantsToBuy: ${isNewBuyIntent}, wantsHumanAgent: ${isNewHumanIntent}, asksAboutPrice: ${isNewPriceIntent}, aiUnsure: ${isNewUnsureIntent}`)
        await sendAdminNotification(chatbotId, sessionId, cleanPhoneNumber, analysis)
      } else if (analysis.wantsToBuy || analysis.wantsHumanAgent || analysis.asksAboutPrice || analysis.aiUnsure) {
        console.log(`Intent already notified previously - skipping duplicate notification`)
      }
    }

  } catch (err) {
    console.error('Error in analyzeAndTagContact:', err)
  }
}

/**
 * Generate AI follow-up message based on contact context
 */
async function generateFollowUpMessage(contact, tagConfig) {
  try {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY
    if (!OPENAI_API_KEY) {
      // Return default template if no AI
      return tagConfig?.followup_template || "Hi! Just checking in. How can I help you today?"
    }

    // If tag has a template, use it
    if (tagConfig?.followup_template) {
      return tagConfig.followup_template
    }

    // Get recent conversation for context from whatsapp_web_messages
    // Phone number in contact_profiles is stored without @s.whatsapp.net
    const phoneWithSuffix = contact.phone_number.includes('@')
      ? contact.phone_number
      : `${contact.phone_number}@s.whatsapp.net`

    const { data: recentMessages } = await supabase
      .from('whatsapp_web_messages')
      .select('content, direction')
      .eq('chatbot_id', contact.chatbot_id)
      .or(`from_number.eq.${phoneWithSuffix},to_number.eq.${phoneWithSuffix}`)
      .order('timestamp', { ascending: false })
      .limit(20)

    const conversationContext = recentMessages?.reverse()
      .map(m => {
        const content = m.content || ''
        if (m.direction === 'inbound') {
          return `Customer: ${content}`
        } else if (m.direction === 'outbound') {
          return `Assistant: ${content}`
        }
        return ''
      })
      .filter(line => line !== '')
      .join('\n') || ''

    const prompt = `Generate a natural, friendly WhatsApp follow-up message for this customer.

Context:
- Primary tag: ${contact.primary_tag}
- Summary: ${contact.ai_summary || 'No summary available'}
- Sentiment: ${contact.ai_sentiment || 'neutral'}

Recent conversation:
${conversationContext}

Generate a short, natural follow-up message (1-2 sentences) in the same language as the conversation.
The message should be helpful, not pushy. Don't use emojis excessively.
Respond with ONLY the message text, no quotes or explanation.`

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 150
      })
    })

    if (!response.ok) {
      console.error('Error generating follow-up message')
      return "Hi! Just checking in. Is there anything I can help you with?"
    }

    const result = await response.json()
    return result.choices[0].message.content.trim()

  } catch (err) {
    console.error('Error generating follow-up message:', err)
    return "Hi! Just checking in. Is there anything I can help you with?"
  }
}

/**
 * Check if current time is within business hours
 */
function isWithinBusinessHours(settings) {
  if (!settings?.business_hours_only) return true

  const now = new Date()
  const hour = now.getHours()
  const startHour = settings.start_hour || 9
  const endHour = settings.end_hour || 21

  return hour >= startHour && hour < endHour
}

/**
 * POST /api/followups/process-auto
 * Process automatic follow-ups for all chatbots
 */
app.post('/api/followups/process-auto', async (req, res) => {
  try {
    console.log('Processing automatic follow-ups...')

    // Get all contacts due for follow-up
    const { data: dueContacts, error: fetchError } = await supabase
      .from('contact_profiles')
      .select(`
        *,
        followup_settings:followup_settings!contact_profiles_chatbot_id_fkey(*)
      `)
      .eq('auto_followup_enabled', true)
      .not('followup_due_at', 'is', null)
      .lte('followup_due_at', new Date().toISOString())

    if (fetchError) {
      console.error('Error fetching due contacts:', fetchError)
      return res.status(500).json({ error: 'Failed to fetch due contacts' })
    }

    if (!dueContacts || dueContacts.length === 0) {
      console.log('No contacts due for follow-up')
      return res.json({ processed: 0, message: 'No follow-ups due' })
    }

    console.log(`Found ${dueContacts.length} contact(s) due for follow-up`)

    let processed = 0
    let skipped = 0

    for (const contact of dueContacts) {
      try {
        // Get settings for this chatbot
        const { data: settings } = await supabase
          .from('followup_settings')
          .select('*')
          .eq('chatbot_id', contact.chatbot_id)
          .single()

        // Check if auto-followup is enabled
        if (!settings?.auto_followup_enabled) {
          console.log(`Auto follow-up disabled for chatbot ${contact.chatbot_id}`)
          skipped++
          continue
        }

        // Check max follow-ups
        if (contact.followup_count >= (settings.max_followups_per_contact || 3)) {
          console.log(`Max follow-ups reached for ${contact.phone_number}`)
          skipped++
          continue
        }

        // Check business hours
        if (!isWithinBusinessHours(settings)) {
          console.log('Outside business hours, skipping')
          skipped++
          continue
        }

        // Get socket for this session
        const socketData = whatsappSockets.get(contact.session_id)
        if (!socketData) {
          console.log(`No active socket for session ${contact.session_id}`)
          skipped++
          continue
        }

        // Get tag configuration
        const { data: tagConfig } = await supabase
          .from('followup_tags')
          .select('*')
          .eq('chatbot_id', contact.chatbot_id)
          .eq('tag_name', contact.primary_tag)
          .single()

        // Generate follow-up message
        const followupMessage = await generateFollowUpMessage(contact, tagConfig)
        console.log(`Sending follow-up to ${contact.phone_number}: "${followupMessage.substring(0, 50)}..."`)

        // Send message - add @s.whatsapp.net suffix if not present
        const phoneJid = contact.phone_number.includes('@')
          ? contact.phone_number
          : `${contact.phone_number}@s.whatsapp.net`
        await sendWhatsAppMessage(socketData.sock, phoneJid, followupMessage)

        // Log to follow-up history
        await supabase.from('followup_history').insert({
          contact_id: contact.id,
          user_id: contact.user_id,
          chatbot_id: contact.chatbot_id,
          trigger_type: 'auto',
          trigger_tag: contact.primary_tag,
          message_sent: followupMessage
        })

        // Update contact profile
        await supabase
          .from('contact_profiles')
          .update({
            last_followup_at: new Date().toISOString(),
            followup_count: (contact.followup_count || 0) + 1,
            followup_due_at: null // Reset until next message
          })
          .eq('id', contact.id)

        processed++
        console.log(`Follow-up sent successfully to ${contact.phone_number}`)

      } catch (contactErr) {
        console.error(`Error processing follow-up for ${contact.phone_number}:`, contactErr)
        skipped++
      }
    }

    res.json({
      success: true,
      processed,
      skipped,
      message: `Processed ${processed} follow-up(s), skipped ${skipped}`
    })

  } catch (err) {
    console.error('Error in /api/followups/process-auto:', err)
    res.status(500).json({ error: err.message })
  }
})

/**
 * POST /api/followups/send-by-tag
 * Manually send follow-up to contacts by tag or specific contact IDs
 */
app.post('/api/followups/send-by-tag', async (req, res) => {
  try {
    const { chatbotId, sessionId, tag, customMessage, contactIds, userId } = req.body

    if (!chatbotId || !sessionId) {
      return res.status(400).json({ error: 'chatbotId and sessionId are required' })
    }

    // Get socket
    const socketData = whatsappSockets.get(sessionId)
    if (!socketData) {
      return res.status(404).json({ error: 'Session not found or not connected' })
    }

    // Build query for contacts
    let query = supabase
      .from('contact_profiles')
      .select('*')
      .eq('chatbot_id', chatbotId)

    if (contactIds && contactIds.length > 0) {
      query = query.in('id', contactIds)
    } else if (tag) {
      query = query.contains('tags', [tag])
    } else {
      return res.status(400).json({ error: 'Either tag or contactIds must be provided' })
    }

    const { data: contacts, error: fetchError } = await query

    if (fetchError) {
      console.error('Error fetching contacts:', fetchError)
      return res.status(500).json({ error: 'Failed to fetch contacts' })
    }

    if (!contacts || contacts.length === 0) {
      return res.json({ sent: 0, message: 'No contacts found' })
    }

    console.log(`Sending manual follow-up to ${contacts.length} contact(s)`)

    let sent = 0
    let failed = 0

    for (const contact of contacts) {
      try {
        // Get tag configuration
        const { data: tagConfig } = await supabase
          .from('followup_tags')
          .select('*')
          .eq('chatbot_id', chatbotId)
          .eq('tag_name', contact.primary_tag)
          .single()

        // Use custom message or generate one
        const message = customMessage || await generateFollowUpMessage(contact, tagConfig)

        // Send message - add @s.whatsapp.net suffix if not present
        const phoneJid = contact.phone_number.includes('@')
          ? contact.phone_number
          : `${contact.phone_number}@s.whatsapp.net`
        await sendWhatsAppMessage(socketData.sock, phoneJid, message)

        // Log to history
        await supabase.from('followup_history').insert({
          contact_id: contact.id,
          user_id: userId || contact.user_id,
          chatbot_id: chatbotId,
          trigger_type: 'manual',
          trigger_tag: tag || 'custom',
          message_sent: message
        })

        // Update contact
        await supabase
          .from('contact_profiles')
          .update({
            last_followup_at: new Date().toISOString(),
            followup_count: (contact.followup_count || 0) + 1
          })
          .eq('id', contact.id)

        sent++
        console.log(`Follow-up sent to ${contact.phone_number}`)

        // Add delay between messages (anti-spam)
        await new Promise(resolve => setTimeout(resolve, 3000))

      } catch (contactErr) {
        console.error(`Error sending to ${contact.phone_number}:`, contactErr)
        failed++
      }
    }

    res.json({
      success: true,
      sent,
      failed,
      message: `Sent ${sent} follow-up(s), failed ${failed}`
    })

  } catch (err) {
    console.error('Error in /api/followups/send-by-tag:', err)
    res.status(500).json({ error: err.message })
  }
})

/**
 * GET /api/followups/contacts
 * Get contacts with tags for a chatbot
 */
app.get('/api/followups/contacts', async (req, res) => {
  try {
    const { chatbotId, tag, limit = 100 } = req.query

    if (!chatbotId) {
      return res.status(400).json({ error: 'chatbotId is required' })
    }

    let query = supabase
      .from('contact_profiles')
      .select('*')
      .eq('chatbot_id', chatbotId)
      .order('last_message_at', { ascending: false })
      .limit(parseInt(limit))

    if (tag) {
      query = query.contains('tags', [tag])
    }

    const { data: contacts, error } = await query

    if (error) {
      console.error('Error fetching contacts:', error)
      return res.status(500).json({ error: 'Failed to fetch contacts' })
    }

    res.json({
      success: true,
      count: contacts?.length || 0,
      contacts: contacts || []
    })

  } catch (err) {
    console.error('Error in /api/followups/contacts:', err)
    res.status(500).json({ error: err.message })
  }
})

/**
 * GET /api/followups/stats
 * Get follow-up statistics for a chatbot
 */
app.get('/api/followups/stats', async (req, res) => {
  try {
    const { chatbotId } = req.query

    if (!chatbotId) {
      return res.status(400).json({ error: 'chatbotId is required' })
    }

    // Get contact count by tag
    const { data: tagStats } = await supabase
      .rpc('get_contact_stats_by_tag', { p_chatbot_id: chatbotId })

    // Get total contacts
    const { count: totalContacts } = await supabase
      .from('contact_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('chatbot_id', chatbotId)

    // Get pending follow-ups
    const { count: pendingFollowups } = await supabase
      .from('contact_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('chatbot_id', chatbotId)
      .not('followup_due_at', 'is', null)
      .lte('followup_due_at', new Date().toISOString())

    // Get sent follow-ups in last 24h
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { count: sentLast24h } = await supabase
      .from('followup_history')
      .select('*', { count: 'exact', head: true })
      .eq('chatbot_id', chatbotId)
      .gte('sent_at', yesterday)

    res.json({
      success: true,
      stats: {
        totalContacts: totalContacts || 0,
        pendingFollowups: pendingFollowups || 0,
        sentLast24h: sentLast24h || 0,
        byTag: tagStats || []
      }
    })

  } catch (err) {
    console.error('Error in /api/followups/stats:', err)
    res.status(500).json({ error: err.message })
  }
})

/**
 * POST /api/followups/initialize-tags
 * Initialize default tags for a chatbot
 */
app.post('/api/followups/initialize-tags', async (req, res) => {
  try {
    const { chatbotId, userId } = req.body

    if (!chatbotId || !userId) {
      return res.status(400).json({ error: 'chatbotId and userId are required' })
    }

    // Call the database function to initialize default tags
    const { error } = await supabase
      .rpc('initialize_default_tags', {
        p_chatbot_id: chatbotId,
        p_user_id: userId
      })

    if (error) {
      console.error('Error initializing tags:', error)
      return res.status(500).json({ error: 'Failed to initialize tags' })
    }

    // Also create default settings if not exists
    await supabase
      .from('followup_settings')
      .upsert({
        chatbot_id: chatbotId,
        user_id: userId,
        auto_tagging_enabled: true,
        auto_followup_enabled: true
      }, { onConflict: 'chatbot_id' })

    res.json({ success: true, message: 'Default tags initialized' })

  } catch (err) {
    console.error('Error in /api/followups/initialize-tags:', err)
    res.status(500).json({ error: err.message })
  }
})

// ====================================================
// CHAT HISTORY API (For n8n integration)
// ====================================================

/**
 * GET /api/chat-history
 * Fetch conversation history for a chatbot+phone in n8n-compatible format
 *
 * Query params:
 * - chatbotId: UUID of the chatbot
 * - phoneNumber: Customer phone number (with or without @s.whatsapp.net)
 * - limit: Number of messages to fetch (default 20, max 100)
 *
 * Returns: Array of { role: 'user'|'assistant', content: string }
 */
app.get('/api/chat-history', async (req, res) => {
  try {
    const { chatbotId, phoneNumber, limit = 20 } = req.query

    if (!chatbotId || !phoneNumber) {
      return res.status(400).json({
        error: 'chatbotId and phoneNumber are required',
        example: '/api/chat-history?chatbotId=xxx&phoneNumber=60123456789'
      })
    }

    // Clean phone number - handle both formats
    const cleanPhone = phoneNumber.replace('@s.whatsapp.net', '').replace('@lid', '').replace(/[^0-9]/g, '')
    const phoneWithSuffix = `${cleanPhone}@s.whatsapp.net`

    // Fetch messages from whatsapp_web_messages
    const { data: messages, error } = await supabase
      .from('whatsapp_web_messages')
      .select('content, direction, timestamp')
      .eq('chatbot_id', chatbotId)
      .or(`from_number.eq.${phoneWithSuffix},to_number.eq.${phoneWithSuffix}`)
      .order('timestamp', { ascending: true })
      .limit(Math.min(parseInt(limit), 100))

    if (error) {
      console.error('Error fetching chat history:', error)
      return res.status(500).json({ error: 'Failed to fetch chat history' })
    }

    // Convert to n8n AI Agent format: { role, content }
    const chatHistory = (messages || []).map(msg => ({
      role: msg.direction === 'inbound' ? 'user' : 'assistant',
      content: msg.content || ''
    }))

    res.json({
      success: true,
      chatbotId,
      phoneNumber: cleanPhone,
      messageCount: chatHistory.length,
      chatHistory
    })

  } catch (err) {
    console.error('Error in /api/chat-history:', err)
    res.status(500).json({ error: err.message })
  }
})

/**
 * POST /api/chat-history
 * Same as GET but accepts body params (for n8n HTTP Request POST)
 */
app.post('/api/chat-history', async (req, res) => {
  try {
    const { chatbotId, phoneNumber, limit = 20 } = req.body

    if (!chatbotId || !phoneNumber) {
      return res.status(400).json({
        error: 'chatbotId and phoneNumber are required'
      })
    }

    // Clean phone number
    const cleanPhone = phoneNumber.replace('@s.whatsapp.net', '').replace('@lid', '').replace(/[^0-9]/g, '')
    const phoneWithSuffix = `${cleanPhone}@s.whatsapp.net`

    // Fetch messages
    const { data: messages, error } = await supabase
      .from('whatsapp_web_messages')
      .select('content, direction, timestamp')
      .eq('chatbot_id', chatbotId)
      .or(`from_number.eq.${phoneWithSuffix},to_number.eq.${phoneWithSuffix}`)
      .order('timestamp', { ascending: true })
      .limit(Math.min(parseInt(limit), 100))

    if (error) {
      console.error('Error fetching chat history:', error)
      return res.status(500).json({ error: 'Failed to fetch chat history' })
    }

    // Convert to n8n format
    const chatHistory = (messages || []).map(msg => ({
      role: msg.direction === 'inbound' ? 'user' : 'assistant',
      content: msg.content || ''
    }))

    res.json({
      success: true,
      chatbotId,
      phoneNumber: cleanPhone,
      messageCount: chatHistory.length,
      chatHistory
    })

  } catch (err) {
    console.error('Error in /api/chat-history:', err)
    res.status(500).json({ error: err.message })
  }
})

// Scheduled follow-up processor (runs every hour)
let followupProcessorInterval = null

function startFollowupProcessor() {
  // Process follow-ups every hour
  followupProcessorInterval = setInterval(async () => {
    console.log('Running scheduled follow-up processor...')
    try {
      // Call our own endpoint
      const response = await fetch(`http://localhost:${PORT}/api/followups/process-auto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      const result = await response.json()
      console.log('Scheduled follow-up result:', result)
    } catch (err) {
      console.error('Error in scheduled follow-up processor:', err)
    }
  }, 60 * 60 * 1000) // Every hour

  console.log('Follow-up processor scheduled (runs every hour)')
}

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

    // Start the follow-up processor after server is ready
    startFollowupProcessor()
  })
}

startServer().catch(console.error)
