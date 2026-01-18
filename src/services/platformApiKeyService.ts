// Platform API Key Service
// Handles creation and management of platform API keys for chatbots

import { supabase } from '@/integrations/supabase/client';

export interface PlatformApiKeyResult {
  success: boolean;
  apiKey?: string;
  apiKeyId?: string;
  error?: string;
}

/**
 * Generate a random API key with prefix
 */
const generateApiKey = (): string => {
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  const randomString = Array.from(randomBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return `pk_live_${randomString}`;
};

/**
 * Hash an API key using SHA-256
 */
const hashApiKey = async (apiKey: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

/**
 * Create a platform API key for a chatbot
 * This is used when a chatbot is created to auto-generate an API key
 *
 * When an admin creates a key for another user, it uses the admin_create_platform_api_key
 * database function to bypass RLS and correctly store the target user's user_id.
 */
export const createPlatformApiKey = async (
  userId: string,
  chatbotId: string | null,
  chatbotName: string,
  isAdminCreating: boolean = false
): Promise<PlatformApiKeyResult> => {
  try {
    // Generate the API key
    const apiKey = generateApiKey();
    const apiKeyHash = await hashApiKey(apiKey);
    const apiKeyPrefix = apiKey.substring(0, 15) + '...';

    // Default scopes for auto-generated keys
    const defaultScopes = ['chat', 'config', 'products', 'promotions', 'knowledge'];

    const keyName = chatbotId ? `Auto: ${chatbotName}` : chatbotName;
    const description = chatbotId
      ? `Auto-generated API key for ${chatbotName}. Use this key for n8n integrations.`
      : `General API key: ${chatbotName}`;

    let keyId: string;

    // If admin is creating key for another user, use the RPC function to bypass RLS
    if (isAdminCreating) {
      console.log('Admin creating API key for user:', userId, 'chatbot:', chatbotId);

      const { data, error } = await supabase.rpc('admin_create_platform_api_key', {
        p_user_id: userId,
        p_key_name: keyName,
        p_api_key_hash: apiKeyHash,
        p_api_key_prefix: apiKeyPrefix,
        p_scopes: defaultScopes,
        p_avatar_id: chatbotId,
        p_description: description
      });

      if (error) {
        console.error('Error creating platform API key via admin RPC:', error);
        return {
          success: false,
          error: error.message
        };
      }

      keyId = data;
    } else {
      // Regular insert for users creating their own keys
      const { data, error } = await supabase
        .from('platform_api_keys')
        .insert({
          user_id: userId,
          key_name: keyName,
          api_key_hash: apiKeyHash,
          api_key_prefix: apiKeyPrefix,
          scopes: defaultScopes,
          avatar_id: chatbotId,
          description: description,
          status: 'active'
        })
        .select('id')
        .single();

      if (error) {
        console.error('Error creating platform API key:', error);
        return {
          success: false,
          error: error.message
        };
      }

      keyId = data.id;
    }

    return {
      success: true,
      apiKey,
      apiKeyId: keyId
    };
  } catch (error: any) {
    console.error('Error in createPlatformApiKey:', error);
    return {
      success: false,
      error: error.message || 'Failed to create API key'
    };
  }
};

/**
 * Get the platform API key for a chatbot
 * Note: This only returns the prefix since the actual key is hashed
 */
export const getPlatformApiKeyForChatbot = async (
  userId: string,
  chatbotId: string
): Promise<{ id: string; prefix: string; status: string } | null> => {
  try {
    const { data, error } = await supabase
      .from('platform_api_keys')
      .select('id, api_key_prefix, status')
      .eq('user_id', userId)
      .eq('avatar_id', chatbotId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      prefix: data.api_key_prefix,
      status: data.status
    };
  } catch (error) {
    console.error('Error getting platform API key:', error);
    return null;
  }
};

/**
 * Check if a chatbot already has a platform API key
 */
export const hasPlatformApiKey = async (
  userId: string,
  chatbotId: string
): Promise<boolean> => {
  const key = await getPlatformApiKeyForChatbot(userId, chatbotId);
  return key !== null;
};

/**
 * Regenerate a platform API key for a chatbot
 * This deactivates the old key and creates a new one
 */
export const regeneratePlatformApiKey = async (
  userId: string,
  chatbotId: string,
  chatbotName: string,
  isAdminCreating: boolean = false
): Promise<PlatformApiKeyResult> => {
  try {
    // Deactivate existing keys for this chatbot
    await supabase
      .from('platform_api_keys')
      .update({ status: 'inactive' })
      .eq('user_id', userId)
      .eq('avatar_id', chatbotId)
      .eq('status', 'active');

    // Create a new key
    return await createPlatformApiKey(userId, chatbotId, chatbotName, isAdminCreating);
  } catch (error: any) {
    console.error('Error regenerating platform API key:', error);
    return {
      success: false,
      error: error.message || 'Failed to regenerate API key'
    };
  }
};
