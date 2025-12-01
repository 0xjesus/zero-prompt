import crypto from 'crypto';

// Use environment variable or a fallback for dev (WARNING: Use a real key in prod)
// Generate one with: openssl rand -hex 32
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff"; 
const IV_LENGTH = 16; // For AES, this is always 16

export const encryptionService = {
  encrypt: (text: string): string => {
    if (!text) return text;
    try {
      const iv = crypto.randomBytes(IV_LENGTH);
      const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
      let encrypted = cipher.update(text);
      encrypted = Buffer.concat([encrypted, cipher.final()]);
      const authTag = cipher.getAuthTag();
      
      // Format: IV:AuthTag:EncryptedData
      return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted.toString('hex');
    } catch (e) {
      console.error("Encryption failed", e);
      return text; // Fallback to plain text to avoid data loss in unstable envs
    }
  },

  decrypt: (text: string): string => {
    if (!text || !text.includes(':')) return text; // Return as is if not encrypted format
    try {
      const textParts = text.split(':');
      if (textParts.length !== 3) return text;

      const iv = Buffer.from(textParts[0], 'hex');
      const authTag = Buffer.from(textParts[1], 'hex');
      const encryptedText = Buffer.from(textParts[2], 'hex');
      
      const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encryptedText);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      
      return decrypted.toString();
    } catch (e) {
      console.error("Decryption failed", e);
      return text; // Could not decrypt
    }
  }
};
