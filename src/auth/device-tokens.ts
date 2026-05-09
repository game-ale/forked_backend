import crypto from 'crypto';
import { env } from '../config/env';

/**
 * Prefix used to identify raw hardware device tokens.
 */
export const DEVICE_TOKEN_PREFIX = 'fd_device_';

/**
 * Cryptographically hashes a raw device token using HMAC-SHA256 and the application pepper.
 * 
 * @param token The raw device token string.
 * @returns The hex-encoded HMAC SHA-256 hash.
 */
export function hashDeviceToken(token: string): string {
  if (!env.authDeviceTokenPepper) {
    throw new Error('Server configuration error: AUTH_DEVICE_TOKEN_PEPPER is required.');
  }

  return crypto
    .createHmac('sha256', env.authDeviceTokenPepper)
    .update(token)
    .digest('hex');
}

/**
 * Generates a new, cryptographically secure raw device token and its corresponding hash.
 * The raw token should be returned to the client ONCE. The hash should be saved to the database.
 * 
 * @param deviceId The unique identifier of the device.
 * @returns Object containing the raw `token` and the `hash` to store in the DB.
 */
export function generateDeviceToken(deviceId: string): { token: string; hash: string } {
  // Generate 32 bytes of secure random data
  const secret = crypto.randomBytes(32).toString('hex');
  
  // Format: fd_device_<deviceId>_<secret>
  const token = `${DEVICE_TOKEN_PREFIX}${deviceId}_${secret}`;
  
  // Hash the token for database storage
  const hash = hashDeviceToken(token);
  
  return { token, hash };
}
