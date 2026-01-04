/**
 * WhatsApp Encryption Service
 *
 * Provides AES-256-GCM encryption for WhatsApp access tokens.
 * This is a significant security improvement over the Base64 encoding
 * currently used in apiKeyService.ts.
 *
 * Security features:
 * - AES-256-GCM (authenticated encryption)
 * - Random IV (Initialization Vector) for each encryption
 * - HMAC verification built into GCM mode
 * - Key derivation from master key using PBKDF2
 */

// IMPORTANT: In production, store this in environment variables or Supabase Vault
// For now, we'll use a constant, but this MUST be changed before deployment
const ENCRYPTION_KEY_BASE = import.meta.env.VITE_WHATSAPP_ENCRYPTION_KEY || 'CHANGE_THIS_IN_PRODUCTION_USE_RANDOM_256_BIT_KEY';

/**
 * Derives an AES-256-GCM key from the base encryption key
 */
async function deriveKey(baseKey: string): Promise<CryptoKey> {
  // Convert base key to Uint8Array
  const encoder = new TextEncoder();
  const keyMaterial = encoder.encode(baseKey);

  // Import as raw key material
  const importedKey = await crypto.subtle.importKey(
    'raw',
    keyMaterial,
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  // Derive AES-256-GCM key using PBKDF2
  // Using a fixed salt because we don't store it separately
  // In a more robust system, you'd store salt with each encrypted value
  const salt = encoder.encode('whatsapp-encryption-salt-v1');

  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    importedKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts plaintext using AES-256-GCM
 *
 * @param plaintext - The text to encrypt (e.g., WhatsApp access token)
 * @returns Base64-encoded string containing IV + ciphertext
 */
export async function encryptToken(plaintext: string): Promise<string> {
  try {
    // Derive encryption key
    const key = await deriveKey(ENCRYPTION_KEY_BASE);

    // Generate random 12-byte IV (recommended for GCM)
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Encode plaintext
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);

    // Encrypt using AES-GCM
    const encryptedData = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        tagLength: 128 // 128-bit authentication tag
      },
      key,
      data
    );

    // Combine IV + encrypted data
    const combined = new Uint8Array(iv.length + encryptedData.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encryptedData), iv.length);

    // Convert to base64 for storage
    return btoa(String.fromCharCode(...combined));
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt token');
  }
}

/**
 * Decrypts ciphertext using AES-256-GCM
 *
 * @param ciphertext - Base64-encoded string containing IV + ciphertext
 * @returns Decrypted plaintext
 */
export async function decryptToken(ciphertext: string): Promise<string> {
  try {
    // Derive encryption key
    const key = await deriveKey(ENCRYPTION_KEY_BASE);

    // Decode from base64
    const combined = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));

    // Extract IV (first 12 bytes) and encrypted data
    const iv = combined.slice(0, 12);
    const encryptedData = combined.slice(12);

    // Decrypt using AES-GCM
    const decryptedData = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        tagLength: 128
      },
      key,
      encryptedData
    );

    // Decode plaintext
    const decoder = new TextDecoder();
    return decoder.decode(decryptedData);
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt token - token may be corrupted or key is incorrect');
  }
}

/**
 * Generates a random webhook verify token
 *
 * @returns Random hex string (64 characters)
 */
export function generateWebhookVerifyToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Masks an access token for display in UI
 * Shows first 8 and last 4 characters, hides the rest
 *
 * @param token - The token to mask
 * @returns Masked token (e.g., "EAAG1234...abcd")
 */
export function maskToken(token: string): string {
  if (!token || token.length < 12) {
    return '••••••••••••';
  }

  const prefix = token.substring(0, 8);
  const suffix = token.substring(token.length - 4);
  return `${prefix}••••••••${suffix}`;
}

/**
 * WhatsApp Encryption Service
 * Provides encryption, decryption, and utility functions
 */
export const WhatsAppEncryption = {
  encrypt: encryptToken,
  decrypt: decryptToken,
  generateWebhookToken: generateWebhookVerifyToken,
  mask: maskToken
};

export default WhatsAppEncryption;
