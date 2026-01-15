/**
 * Followup Service
 *
 * Frontend service for Smart Follow-Up System with AI Tagging
 *
 * Provides methods to:
 * - Get contacts with AI-assigned tags
 * - Manage follow-up tags
 * - Configure follow-up settings
 * - Send manual follow-ups
 * - View follow-up history
 */

import { supabase } from '@/integrations/supabase/client'

// WhatsApp Web Service URL (local development)
const WHATSAPP_SERVICE_URL = import.meta.env.VITE_WHATSAPP_SERVICE_URL || 'http://localhost:3001'

// =====================================================
// TYPES
// =====================================================

export interface ContactProfile {
  id: string
  user_id: string
  chatbot_id: string
  session_id: string
  phone_number: string
  contact_name?: string
  tags: string[]
  primary_tag?: string
  last_message_at?: string
  last_message_role?: 'user' | 'assistant'
  message_count: number
  auto_followup_enabled: boolean
  followup_due_at?: string
  last_followup_at?: string
  followup_count: number
  ai_summary?: string
  ai_sentiment?: 'positive' | 'neutral' | 'negative'
  ai_analysis?: Record<string, unknown>
  analyzed_at?: string
  // AI Pause fields (human takeover)
  ai_paused: boolean
  ai_paused_at?: string
  ai_paused_reason?: string
  created_at: string
  updated_at: string
}

export interface FollowupTag {
  id: string
  user_id: string
  chatbot_id: string
  tag_name: string
  description?: string
  color: string
  auto_followup: boolean
  followup_delay_hours: number
  followup_template?: string
  is_system: boolean
  created_at: string
  updated_at: string
}

export interface FollowupSettings {
  id: string
  user_id: string
  chatbot_id: string
  auto_tagging_enabled: boolean
  auto_followup_enabled: boolean
  business_hours_only: boolean
  start_hour: number
  end_hour: number
  max_followups_per_contact: number
  ai_model: string
  // Admin notification fields
  notification_enabled: boolean
  notification_phone_number: string | null
  notify_on_purchase_intent: boolean
  notify_on_wants_human: boolean
  notify_on_price_inquiry: boolean
  notify_on_ai_unsure: boolean
  auto_pause_on_notification: boolean
  created_at: string
  updated_at: string
}

export interface FollowupHistoryItem {
  id: string
  contact_id: string
  user_id: string
  chatbot_id: string
  trigger_type: 'auto' | 'manual'
  trigger_tag?: string
  message_sent: string
  sent_at: string
  response_received: boolean
  response_at?: string
  created_at: string
  // Joined contact info
  contact?: ContactProfile
}

export interface FollowupStats {
  totalContacts: number
  pendingFollowups: number
  sentLast24h: number
  byTag: { tag_name: string; contact_count: number }[]
}

// =====================================================
// CONTACTS
// =====================================================

/**
 * Get all contacts with tags for a chatbot
 */
export async function getContacts(
  chatbotId: string,
  options?: {
    tag?: string
    sentiment?: string
    limit?: number
    offset?: number
  }
): Promise<ContactProfile[]> {
  let query = supabase
    .from('contact_profiles')
    .select('*')
    .eq('chatbot_id', chatbotId)
    .order('last_message_at', { ascending: false })

  if (options?.tag) {
    query = query.contains('tags', [options.tag])
  }

  if (options?.sentiment) {
    query = query.eq('ai_sentiment', options.sentiment)
  }

  if (options?.limit) {
    query = query.limit(options.limit)
  }

  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 100) - 1)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching contacts:', error)
    throw new Error('Failed to fetch contacts')
  }

  return data || []
}

/**
 * Get a single contact profile
 */
export async function getContact(contactId: string): Promise<ContactProfile | null> {
  const { data, error } = await supabase
    .from('contact_profiles')
    .select('*')
    .eq('id', contactId)
    .single()

  if (error) {
    console.error('Error fetching contact:', error)
    return null
  }

  return data
}

/**
 * Update contact profile (e.g., enable/disable auto follow-up)
 */
export async function updateContact(
  contactId: string,
  updates: Partial<ContactProfile>
): Promise<ContactProfile> {
  const { data, error } = await supabase
    .from('contact_profiles')
    .update(updates)
    .eq('id', contactId)
    .select()
    .single()

  if (error) {
    console.error('Error updating contact:', error)
    throw new Error('Failed to update contact')
  }

  return data
}

// =====================================================
// TAGS
// =====================================================

/**
 * Get all tags for a chatbot
 */
export async function getTags(chatbotId: string): Promise<FollowupTag[]> {
  const { data, error } = await supabase
    .from('followup_tags')
    .select('*')
    .eq('chatbot_id', chatbotId)
    .order('tag_name', { ascending: true })

  if (error) {
    console.error('Error fetching tags:', error)
    throw new Error('Failed to fetch tags')
  }

  return data || []
}

/**
 * Create a new tag
 */
export async function createTag(
  chatbotId: string,
  userId: string,
  tag: Partial<FollowupTag>
): Promise<FollowupTag> {
  const { data, error } = await supabase
    .from('followup_tags')
    .insert({
      chatbot_id: chatbotId,
      user_id: userId,
      tag_name: tag.tag_name,
      description: tag.description,
      color: tag.color || '#6b7280',
      auto_followup: tag.auto_followup || false,
      followup_delay_hours: tag.followup_delay_hours || 24,
      followup_template: tag.followup_template,
      is_system: false
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating tag:', error)
    throw new Error('Failed to create tag')
  }

  return data
}

/**
 * Update a tag
 */
export async function updateTag(
  tagId: string,
  updates: Partial<FollowupTag>
): Promise<FollowupTag> {
  const { data, error } = await supabase
    .from('followup_tags')
    .update(updates)
    .eq('id', tagId)
    .select()
    .single()

  if (error) {
    console.error('Error updating tag:', error)
    throw new Error('Failed to update tag')
  }

  return data
}

/**
 * Delete a tag (only non-system tags)
 */
export async function deleteTag(tagId: string): Promise<void> {
  const { error } = await supabase
    .from('followup_tags')
    .delete()
    .eq('id', tagId)
    .eq('is_system', false)

  if (error) {
    console.error('Error deleting tag:', error)
    throw new Error('Failed to delete tag')
  }
}

/**
 * Initialize default tags for a chatbot
 */
export async function initializeDefaultTags(
  chatbotId: string,
  userId: string
): Promise<void> {
  try {
    const response = await fetch(`${WHATSAPP_SERVICE_URL}/api/followups/initialize-tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatbotId, userId })
    })

    if (!response.ok) {
      throw new Error('Failed to initialize tags')
    }
  } catch (error) {
    console.error('Error initializing tags:', error)
    throw error
  }
}

// =====================================================
// SETTINGS
// =====================================================

/**
 * Get follow-up settings for a chatbot
 */
export async function getSettings(chatbotId: string): Promise<FollowupSettings | null> {
  const { data, error } = await supabase
    .from('followup_settings')
    .select('*')
    .eq('chatbot_id', chatbotId)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching settings:', error)
  }

  return data
}

/**
 * Create or update follow-up settings
 */
export async function upsertSettings(
  chatbotId: string,
  userId: string,
  settings: Partial<FollowupSettings>
): Promise<FollowupSettings> {
  const { data, error } = await supabase
    .from('followup_settings')
    .upsert({
      chatbot_id: chatbotId,
      user_id: userId,
      ...settings
    }, { onConflict: 'chatbot_id' })
    .select()
    .single()

  if (error) {
    console.error('Error upserting settings:', error)
    throw new Error('Failed to save settings')
  }

  return data
}

// =====================================================
// FOLLOW-UP HISTORY
// =====================================================

/**
 * Get follow-up history for a chatbot
 */
export async function getHistory(
  chatbotId: string,
  options?: {
    contactId?: string
    triggerType?: 'auto' | 'manual'
    limit?: number
  }
): Promise<FollowupHistoryItem[]> {
  let query = supabase
    .from('followup_history')
    .select(`
      *,
      contact:contact_profiles(*)
    `)
    .eq('chatbot_id', chatbotId)
    .order('sent_at', { ascending: false })

  if (options?.contactId) {
    query = query.eq('contact_id', options.contactId)
  }

  if (options?.triggerType) {
    query = query.eq('trigger_type', options.triggerType)
  }

  if (options?.limit) {
    query = query.limit(options.limit)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching history:', error)
    throw new Error('Failed to fetch history')
  }

  return data || []
}

// =====================================================
// STATISTICS
// =====================================================

/**
 * Get follow-up statistics for a chatbot
 */
export async function getStats(chatbotId: string): Promise<FollowupStats> {
  try {
    const response = await fetch(
      `${WHATSAPP_SERVICE_URL}/api/followups/stats?chatbotId=${chatbotId}`
    )

    if (!response.ok) {
      throw new Error('Failed to fetch stats')
    }

    const result = await response.json()
    return result.stats
  } catch (error) {
    console.error('Error fetching stats:', error)
    // Return empty stats on error
    return {
      totalContacts: 0,
      pendingFollowups: 0,
      sentLast24h: 0,
      byTag: []
    }
  }
}

// =====================================================
// SEND FOLLOW-UPS
// =====================================================

/**
 * Send manual follow-up to contacts by tag
 */
export async function sendFollowUpByTag(
  chatbotId: string,
  sessionId: string,
  tag: string,
  customMessage?: string,
  userId?: string
): Promise<{ sent: number; failed: number }> {
  const response = await fetch(`${WHATSAPP_SERVICE_URL}/api/followups/send-by-tag`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chatbotId,
      sessionId,
      tag,
      customMessage,
      userId
    })
  })

  if (!response.ok) {
    throw new Error('Failed to send follow-ups')
  }

  const result = await response.json()
  return { sent: result.sent, failed: result.failed }
}

/**
 * Send manual follow-up to specific contacts
 */
export async function sendFollowUpToContacts(
  chatbotId: string,
  sessionId: string,
  contactIds: string[],
  customMessage?: string,
  userId?: string
): Promise<{ sent: number; failed: number }> {
  const response = await fetch(`${WHATSAPP_SERVICE_URL}/api/followups/send-by-tag`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chatbotId,
      sessionId,
      contactIds,
      customMessage,
      userId
    })
  })

  if (!response.ok) {
    throw new Error('Failed to send follow-ups')
  }

  const result = await response.json()
  return { sent: result.sent, failed: result.failed }
}

/**
 * Trigger automatic follow-up processing
 */
export async function processAutoFollowups(): Promise<{ processed: number; skipped: number }> {
  const response = await fetch(`${WHATSAPP_SERVICE_URL}/api/followups/process-auto`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  })

  if (!response.ok) {
    throw new Error('Failed to process follow-ups')
  }

  const result = await response.json()
  return { processed: result.processed, skipped: result.skipped }
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Get color for sentiment
 */
export function getSentimentColor(sentiment?: string): string {
  switch (sentiment) {
    case 'positive':
      return 'text-green-600 bg-green-100'
    case 'negative':
      return 'text-red-600 bg-red-100'
    case 'neutral':
    default:
      return 'text-gray-600 bg-gray-100'
  }
}

/**
 * Get default tag colors (simplified 5 tags)
 */
export const DEFAULT_TAG_COLORS: Record<string, string> = {
  hot_lead: '#f59e0b',
  new_lead: '#3b82f6',
  customer: '#10b981',
  needs_help: '#ef4444',
  inactive: '#6b7280'
}

/**
 * Format time ago
 */
export function formatTimeAgo(dateString?: string): string {
  if (!dateString) return 'Never'

  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString()
}
