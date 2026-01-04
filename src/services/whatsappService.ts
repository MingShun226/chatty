/**
 * WhatsApp Service
 *
 * Frontend service for WhatsApp Business Cloud API integration
 *
 * Provides methods to:
 * - Manage WhatsApp connections
 * - Send messages
 * - Get conversation history
 * - Manage templates
 * - Create and send broadcasts
 * - Sync product catalogs
 */

import { supabase } from '@/integrations/supabase/client'
import { encryptToken, decryptToken, maskToken } from './whatsappEncryption'

// =====================================================
// TYPES
// =====================================================

export interface WhatsAppConnection {
  id: string
  user_id: string
  chatbot_id: string
  waba_id: string
  phone_number_id: string
  phone_number: string
  display_name?: string
  quality_rating?: 'GREEN' | 'YELLOW' | 'RED'
  status: 'active' | 'inactive' | 'suspended' | 'disconnected'
  messaging_limit?: string
  business_profile?: any
  connected_at: string
  last_sync_at?: string
}

export interface WhatsAppMessage {
  id: string
  connection_id: string
  chatbot_id: string
  whatsapp_message_id: string
  from_phone: string
  to_phone: string
  direction: 'inbound' | 'outbound'
  message_type: string
  content: string
  media_url?: string
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed'
  timestamp: string
  sent_at?: string
  delivered_at?: string
  read_at?: string
}

export interface WhatsAppTemplate {
  id: string
  connection_id: string
  template_name: string
  template_id?: string
  language: string
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION'
  template_body: string
  status: 'pending' | 'approved' | 'rejected' | 'disabled'
  usage_count: number
  parameter_count: number
  parameter_names?: string[]
}

export interface WhatsAppBroadcast {
  id: string
  connection_id: string
  campaign_name: string
  template_name: string
  total_recipients: number
  status: 'draft' | 'scheduled' | 'sending' | 'completed' | 'failed' | 'cancelled'
  messages_sent: number
  messages_delivered: number
  messages_read: number
  messages_failed: number
  scheduled_at?: string
}

// =====================================================
// CONNECTIONS
// =====================================================

/**
 * Get all WhatsApp connections for a chatbot
 */
export async function getConnections(chatbotId: string): Promise<WhatsAppConnection[]> {
  const { data, error } = await supabase
    .from('whatsapp_connections')
    .select('*')
    .eq('chatbot_id', chatbotId)
    .order('connected_at', { ascending: false })

  if (error) {
    console.error('Error fetching WhatsApp connections:', error)
    throw new Error('Failed to fetch WhatsApp connections')
  }

  return data || []
}

/**
 * Get a single WhatsApp connection
 */
export async function getConnection(connectionId: string): Promise<WhatsAppConnection | null> {
  const { data, error } = await supabase
    .from('whatsapp_connections')
    .select('*')
    .eq('id', connectionId)
    .single()

  if (error) {
    console.error('Error fetching WhatsApp connection:', error)
    return null
  }

  return data
}

/**
 * Disconnect a WhatsApp connection (set status to inactive)
 */
export async function disconnectConnection(connectionId: string): Promise<boolean> {
  const { error } = await supabase
    .from('whatsapp_connections')
    .update({ status: 'disconnected' })
    .eq('id', connectionId)

  if (error) {
    console.error('Error disconnecting WhatsApp connection:', error)
    throw new Error('Failed to disconnect WhatsApp connection')
  }

  return true
}

/**
 * Update business profile
 */
export async function updateBusinessProfile(
  connectionId: string,
  profile: any
): Promise<boolean> {
  const { error } = await supabase
    .from('whatsapp_connections')
    .update({ business_profile: profile })
    .eq('id', connectionId)

  if (error) {
    console.error('Error updating business profile:', error)
    throw new Error('Failed to update business profile')
  }

  return true
}

// =====================================================
// MESSAGES
// =====================================================

/**
 * Get messages for a connection
 */
export async function getMessages(
  connectionId: string,
  filters?: {
    fromPhone?: string
    limit?: number
    offset?: number
  }
): Promise<WhatsAppMessage[]> {
  let query = supabase
    .from('whatsapp_messages')
    .select('*')
    .eq('connection_id', connectionId)

  if (filters?.fromPhone) {
    query = query.or(`from_phone.eq.${filters.fromPhone},to_phone.eq.${filters.fromPhone}`)
  }

  query = query
    .order('timestamp', { ascending: false })
    .limit(filters?.limit || 50)

  if (filters?.offset) {
    query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching messages:', error)
    throw new Error('Failed to fetch messages')
  }

  return data || []
}

/**
 * Get conversation contacts (unique phone numbers)
 */
export async function getConversationContacts(connectionId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('whatsapp_messages')
    .select('from_phone, to_phone')
    .eq('connection_id', connectionId)

  if (error) {
    console.error('Error fetching conversation contacts:', error)
    return []
  }

  // Extract unique phone numbers (excluding the connection's own number)
  const connection = await getConnection(connectionId)
  const phoneNumbers = new Set<string>()

  data?.forEach((msg: any) => {
    if (msg.from_phone !== connection?.phone_number) {
      phoneNumbers.add(msg.from_phone)
    }
    if (msg.to_phone !== connection?.phone_number) {
      phoneNumbers.add(msg.to_phone)
    }
  })

  return Array.from(phoneNumbers)
}

/**
 * Send a text message via WhatsApp
 */
export async function sendMessage(
  connectionId: string,
  toPhone: string,
  message: string
): Promise<boolean> {
  // Call the whatsapp-send-message edge function
  // Note: This function will be created in Phase 2
  const { data, error } = await supabase.functions.invoke('whatsapp-send-message', {
    body: {
      connection_id: connectionId,
      to: toPhone,
      type: 'text',
      text: message
    }
  })

  if (error) {
    console.error('Error sending WhatsApp message:', error)
    throw new Error('Failed to send message')
  }

  return data?.success || false
}

/**
 * Mark messages as read
 */
export async function markMessagesAsRead(connectionId: string, messageIds: string[]): Promise<void> {
  // This would call Meta API to mark messages as read
  // For now, just update local database
  const { error } = await supabase
    .from('whatsapp_messages')
    .update({ status: 'read', read_at: new Date().toISOString() })
    .eq('connection_id', connectionId)
    .in('whatsapp_message_id', messageIds)

  if (error) {
    console.error('Error marking messages as read:', error)
  }
}

// =====================================================
// TEMPLATES
// =====================================================

/**
 * Get message templates for a connection
 */
export async function getTemplates(connectionId: string): Promise<WhatsAppTemplate[]> {
  const { data, error } = await supabase
    .from('whatsapp_message_templates')
    .select('*')
    .eq('connection_id', connectionId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching templates:', error)
    throw new Error('Failed to fetch templates')
  }

  return data || []
}

/**
 * Create a new message template
 */
export async function createTemplate(
  connectionId: string,
  template: {
    template_name: string
    language: string
    category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION'
    template_body: string
    header_type?: string
    header_content?: string
    footer_text?: string
    buttons?: any[]
  }
): Promise<WhatsAppTemplate> {
  const { data: user } = await supabase.auth.getUser()
  if (!user.user) throw new Error('Not authenticated')

  const connection = await getConnection(connectionId)
  if (!connection) throw new Error('Connection not found')

  // Extract parameters from template body
  const parameterMatches = template.template_body.match(/\{\{\d+\}\}/g) || []
  const parameterCount = parameterMatches.length

  const { data, error } = await supabase
    .from('whatsapp_message_templates')
    .insert({
      user_id: user.user.id,
      chatbot_id: connection.chatbot_id,
      connection_id: connectionId,
      template_name: template.template_name,
      language: template.language,
      category: template.category,
      template_body: template.template_body,
      header_type: template.header_type,
      header_content: template.header_content,
      footer_text: template.footer_text,
      buttons: template.buttons || [],
      parameter_count: parameterCount,
      status: 'pending'
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating template:', error)
    throw new Error('Failed to create template')
  }

  return data
}

/**
 * Sync templates from Meta API
 */
export async function syncTemplates(connectionId: string): Promise<number> {
  // Call the whatsapp-sync-templates edge function
  const { data, error } = await supabase.functions.invoke('whatsapp-sync-templates', {
    body: { connection_id: connectionId }
  })

  if (error) {
    console.error('Error syncing templates:', error)
    throw new Error('Failed to sync templates')
  }

  return data?.synced_count || 0
}

/**
 * Delete a template
 */
export async function deleteTemplate(templateId: string): Promise<boolean> {
  const { error } = await supabase
    .from('whatsapp_message_templates')
    .update({ status: 'deleted' })
    .eq('id', templateId)

  if (error) {
    console.error('Error deleting template:', error)
    throw new Error('Failed to delete template')
  }

  return true
}

// =====================================================
// BROADCASTS
// =====================================================

/**
 * Get broadcasts for a connection
 */
export async function getBroadcasts(connectionId: string): Promise<WhatsAppBroadcast[]> {
  const { data, error } = await supabase
    .from('whatsapp_broadcasts')
    .select('*')
    .eq('connection_id', connectionId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching broadcasts:', error)
    throw new Error('Failed to fetch broadcasts')
  }

  return data || []
}

/**
 * Create a broadcast campaign
 */
export async function createBroadcast(
  connectionId: string,
  broadcast: {
    campaign_name: string
    template_id: string
    recipient_list: Array<{
      phone: string
      params?: Record<string, string>
    }>
    scheduled_at?: string
  }
): Promise<WhatsAppBroadcast> {
  const { data: user } = await supabase.auth.getUser()
  if (!user.user) throw new Error('Not authenticated')

  const connection = await getConnection(connectionId)
  if (!connection) throw new Error('Connection not found')

  const template = await supabase
    .from('whatsapp_message_templates')
    .select('*')
    .eq('id', broadcast.template_id)
    .single()

  if (template.error || !template.data) {
    throw new Error('Template not found')
  }

  const { data, error } = await supabase
    .from('whatsapp_broadcasts')
    .insert({
      user_id: user.user.id,
      chatbot_id: connection.chatbot_id,
      connection_id: connectionId,
      template_id: broadcast.template_id,
      campaign_name: broadcast.campaign_name,
      template_name: template.data.template_name,
      recipient_list: broadcast.recipient_list,
      total_recipients: broadcast.recipient_list.length,
      status: broadcast.scheduled_at ? 'scheduled' : 'draft',
      scheduled_at: broadcast.scheduled_at
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating broadcast:', error)
    throw new Error('Failed to create broadcast')
  }

  return data
}

/**
 * Send a broadcast campaign
 */
export async function sendBroadcast(broadcastId: string): Promise<boolean> {
  // Call the whatsapp-send-broadcast edge function
  const { data, error } = await supabase.functions.invoke('whatsapp-send-broadcast', {
    body: { broadcast_id: broadcastId }
  })

  if (error) {
    console.error('Error sending broadcast:', error)
    throw new Error('Failed to send broadcast')
  }

  return data?.success || false
}

/**
 * Cancel a scheduled broadcast
 */
export async function cancelBroadcast(broadcastId: string): Promise<boolean> {
  const { error } = await supabase
    .from('whatsapp_broadcasts')
    .update({ status: 'cancelled' })
    .eq('id', broadcastId)

  if (error) {
    console.error('Error cancelling broadcast:', error)
    throw new Error('Failed to cancel broadcast')
  }

  return true
}

// =====================================================
// PRODUCT CATALOG
// =====================================================

/**
 * Get product catalog sync status
 */
export async function getCatalogStatus(connectionId: string): Promise<any> {
  const { data, error } = await supabase
    .from('whatsapp_product_catalogs')
    .select('*')
    .eq('connection_id', connectionId)
    .single()

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
    console.error('Error fetching catalog status:', error)
    return null
  }

  return data
}

/**
 * Sync product catalog with WhatsApp
 */
export async function syncProductCatalog(connectionId: string): Promise<boolean> {
  // Call the whatsapp-sync-catalog edge function
  const { data, error } = await supabase.functions.invoke('whatsapp-sync-catalog', {
    body: { connection_id: connectionId }
  })

  if (error) {
    console.error('Error syncing catalog:', error)
    throw new Error('Failed to sync catalog')
  }

  return data?.success || false
}

/**
 * Enable/disable auto-sync for product catalog
 */
export async function toggleAutoSync(connectionId: string, enabled: boolean): Promise<boolean> {
  const { error } = await supabase
    .from('whatsapp_product_catalogs')
    .update({ auto_sync: enabled })
    .eq('connection_id', connectionId)

  if (error) {
    console.error('Error toggling auto-sync:', error)
    throw new Error('Failed to toggle auto-sync')
  }

  return true
}

// =====================================================
// STATISTICS
// =====================================================

/**
 * Get statistics for a connection
 */
export async function getConnectionStats(connectionId: string): Promise<{
  totalMessages: number
  messagesLast24h: number
  totalContacts: number
  activeContacts: number
  deliveryRate: number
  readRate: number
}> {
  // Get total messages
  const { count: totalMessages } = await supabase
    .from('whatsapp_messages')
    .select('*', { count: 'exact', head: true })
    .eq('connection_id', connectionId)

  // Get messages in last 24 hours
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)

  const { count: messagesLast24h } = await supabase
    .from('whatsapp_messages')
    .select('*', { count: 'exact', head: true })
    .eq('connection_id', connectionId)
    .gte('timestamp', yesterday.toISOString())

  // Get unique contacts
  const contacts = await getConversationContacts(connectionId)

  // Get delivery and read rates
  const { data: outboundMessages } = await supabase
    .from('whatsapp_messages')
    .select('status')
    .eq('connection_id', connectionId)
    .eq('direction', 'outbound')

  const total = outboundMessages?.length || 0
  const delivered = outboundMessages?.filter(m => ['delivered', 'read'].includes(m.status)).length || 0
  const read = outboundMessages?.filter(m => m.status === 'read').length || 0

  const deliveryRate = total > 0 ? (delivered / total) * 100 : 0
  const readRate = total > 0 ? (read / total) * 100 : 0

  return {
    totalMessages: totalMessages || 0,
    messagesLast24h: messagesLast24h || 0,
    totalContacts: contacts.length,
    activeContacts: contacts.length, // Can be refined with recency filter
    deliveryRate: Math.round(deliveryRate),
    readRate: Math.round(readRate)
  }
}

// =====================================================
// EXPORTS
// =====================================================

export const WhatsAppService = {
  // Connections
  getConnections,
  getConnection,
  disconnectConnection,
  updateBusinessProfile,

  // Messages
  getMessages,
  getConversationContacts,
  sendMessage,
  markMessagesAsRead,

  // Templates
  getTemplates,
  createTemplate,
  syncTemplates,
  deleteTemplate,

  // Broadcasts
  getBroadcasts,
  createBroadcast,
  sendBroadcast,
  cancelBroadcast,

  // Product Catalog
  getCatalogStatus,
  syncProductCatalog,
  toggleAutoSync,

  // Statistics
  getConnectionStats
}

export default WhatsAppService
