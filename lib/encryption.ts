// Encryption utility for refresh tokens
// Uses AES-256-GCM for authenticated encryption

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // 16 bytes for AES
const SALT_LENGTH = 64; // 64 bytes for GCM auth tag
const KEY_LENGTH = 32; // 32 bytes for AES-256

/**
 * Get encryption key from environment variable
 * Key should be a 32-byte hex string (64 hex characters)
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error("ENCRYPTION_KEY environment variable is not set");
  }
  if (key.length !== 64) {
    throw new Error("ENCRYPTION_KEY must be a 64-character hex string (32 bytes)");
  }
  return Buffer.from(key, "hex");
}

/**
 * Encrypt a string value (e.g., refresh token)
 * Returns a hex-encoded string containing IV + auth tag + ciphertext
 */
export function encrypt(text: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  
  const cipher = createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  
  // Get the authentication tag (GCM mode)
  const authTag = cipher.getAuthTag();
  
  // Combine IV + auth tag + encrypted data
  // Format: IV (16 bytes) + AuthTag (16 bytes) + EncryptedData
  const combined = Buffer.concat([iv, authTag, Buffer.from(encrypted, "hex")]);
  
  return combined.toString("hex");
}

/**
 * Decrypt a hex-encoded encrypted string
 * Expects format: IV (16 bytes) + AuthTag (16 bytes) + EncryptedData
 */
export function decrypt(encryptedHex: string): string {
  const key = getEncryptionKey();
  const combined = Buffer.from(encryptedHex, "hex");
  
  // Extract IV, auth tag, and ciphertext
  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + 16);
  const encrypted = combined.subarray(IV_LENGTH + 16);
  
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, undefined, "utf8");
  decrypted += decipher.final("utf8");
  
  return decrypted;
}

