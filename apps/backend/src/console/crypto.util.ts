import * as crypto from 'crypto';

const ALG = 'aes-256-gcm';

/**
 * Encrypt a plaintext string with AES-256-GCM.
 * Output format: iv(24 hex) + authTag(32 hex) + ciphertext(hex)
 */
export function encrypt(plaintext: string, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALG, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return iv.toString('hex') + tag.toString('hex') + encrypted.toString('hex');
}

/** Decrypt a value produced by {@link encrypt}. */
export function decrypt(encoded: string, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex');
  const iv = Buffer.from(encoded.slice(0, 24), 'hex');
  const tag = Buffer.from(encoded.slice(24, 56), 'hex');
  const ciphertext = Buffer.from(encoded.slice(56), 'hex');
  const decipher = crypto.createDecipheriv(ALG, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext) + decipher.final('utf8');
}