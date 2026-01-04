/**
 * WhatsApp Encryption Service (Deno/Edge Functions Version)
 *
 * Provides AES-256-GCM encryption for WhatsApp access tokens.
 * This version is optimized for Deno and Supabase Edge Functions.
 *
 * Security features:
 * - AES-256-GCM (authenticated encryption)
 * - Random IV (Initialization Vector) for each encryption
 * - HMAC verification built into GCM mode
 * - Key retrieved from Deno environment variables
 */

/**
 * Gets the encryption key from environment variables
 */
function getEncryptionKey(): string {
  const key = Deno.env.get('WHATSAPP_ENCRYPTION_KEY');
  if (!key) {
    throw new Error('WHATSAPP_ENCRYPTION_KEY environment variable not set');
  }
  return key;
}

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
    const baseKey = getEncryptionKey();
    const key = await deriveKey(baseKey);

    // Generate random 12-byte IV
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Encode plaintext
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);

    // Encrypt using AES-GCM
    const encryptedData = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        tagLength: 128
      },
      key,
      data
    );

    // Combine IV + encrypted data
    const combined = new Uint8Array(iv.length + encryptedData.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encryptedData), iv.length);

    // Convert to base64
    const base64String = btoa(String.fromCharCode(...combined));
    return base64String;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error(`Failed to encrypt token: ${error.message}`);
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
    const baseKey = getEncryptionKey();
    const key = await deriveKey(baseKey);

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
    throw new Error(`Failed to decrypt token: ${error.message}`);
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
 * WhatsApp Encryption Service (Edge Functions)
 */
export const WhatsAppEncryption = {
  encrypt: encryptToken,
  decrypt: decryptToken,
  generateWebhookToken: generateWebhookVerifyToken
};

export default WhatsAppEncryption;
