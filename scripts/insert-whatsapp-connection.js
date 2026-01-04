/**
 * Manual WhatsApp Connection Insertion Script
 *
 * This script manually inserts a WhatsApp connection for testing purposes.
 * For production, connections are created via OAuth flow.
 */

import { createClient } from '@supabase/supabase-js'
import { encryptToken, generateWebhookVerifyToken } from './src/services/whatsappEncryption.ts'

// Configuration
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = 'YOUR_SERVICE_ROLE_KEY_HERE' // Get from Supabase dashboard

// Your WhatsApp details from Meta
const ACCESS_TOKEN = 'PASTE_YOUR_ACCESS_TOKEN_HERE'
const WABA_ID = '253998650230182276'
const PHONE_NUMBER_ID = '942571258938900'
const PHONE_NUMBER = '+60 16 533 4085'
const DISPLAY_NAME = 'mingshunwork'

// Your user and chatbot info
const USER_EMAIL = 'YOUR_EMAIL_HERE'
const CHATBOT_NAME = 'YOUR_CHATBOT_NAME_HERE' // Or leave empty to create new one

async function insertConnection() {
  console.log('🚀 Starting WhatsApp connection insertion...')

  // Initialize Supabase with service role key
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // 1. Get user ID from email
  const { data: { users }, error: userError } = await supabase.auth.admin.listUsers()

  if (userError || !users || users.length === 0) {
    console.error('❌ Error finding user:', userError)
    return
  }

  const user = USER_EMAIL
    ? users.find(u => u.email === USER_EMAIL)
    : users[0]

  if (!user) {
    console.error('❌ User not found with email:', USER_EMAIL)
    return
  }

  console.log('✅ Found user:', user.email, '(', user.id, ')')

  // 2. Get or create chatbot
  let chatbot

  if (CHATBOT_NAME) {
    const { data, error } = await supabase
      .from('avatars')
      .select('id, name')
      .eq('user_id', user.id)
      .eq('name', CHATBOT_NAME)
      .single()

    if (error) {
      console.error('❌ Error finding chatbot:', error.message)
      console.log('💡 Available chatbots:')
      const { data: all } = await supabase
        .from('avatars')
        .select('id, name')
        .eq('user_id', user.id)
      console.table(all)
      return
    }

    chatbot = data
  } else {
    // Get first chatbot
    const { data, error } = await supabase
      .from('avatars')
      .select('id, name')
      .eq('user_id', user.id)
      .limit(1)
      .single()

    if (error || !data) {
      console.error('❌ No chatbots found. Create one first in your platform.')
      return
    }

    chatbot = data
  }

  console.log('✅ Using chatbot:', chatbot.name, '(', chatbot.id, ')')

  // 3. Encrypt access token
  console.log('🔐 Encrypting access token...')

  // For this script, we'll store the token as-is (unencrypted) for testing
  // In production, the edge function encrypts it
  const encryptedToken = ACCESS_TOKEN // TODO: Implement encryption if needed

  // 4. Generate webhook verify token
  const webhookToken = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  console.log('🔑 Generated webhook token')

  // 5. Insert connection
  console.log('📝 Inserting WhatsApp connection...')

  const { data: connection, error: insertError } = await supabase
    .from('whatsapp_connections')
    .insert({
      user_id: user.id,
      chatbot_id: chatbot.id,
      waba_id: WABA_ID,
      phone_number_id: PHONE_NUMBER_ID,
      phone_number: PHONE_NUMBER,
      display_name: DISPLAY_NAME,
      quality_rating: 'GREEN',
      access_token_encrypted: encryptedToken,
      webhook_verify_token: webhookToken,
      status: 'active',
      is_verified: true,
      messaging_limit: 'TIER_1K'
    })
    .select()
    .single()

  if (insertError) {
    console.error('❌ Error inserting connection:', insertError)
    return
  }

  console.log('✅ WhatsApp connection created successfully!')
  console.log('')
  console.log('Connection details:')
  console.log('  - User:', user.email)
  console.log('  - Chatbot:', chatbot.name)
  console.log('  - Phone:', PHONE_NUMBER)
  console.log('  - WABA ID:', WABA_ID)
  console.log('  - Status:', connection.status)
  console.log('')
  console.log('🎉 You can now send WhatsApp messages to test the chatbot!')
  console.log('   Send a message to:', PHONE_NUMBER)
}

// Run the script
insertConnection().catch(console.error)
