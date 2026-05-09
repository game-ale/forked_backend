import { describe, expect, it } from '@jest/globals';
import { generateDeviceToken, hashDeviceToken, DEVICE_TOKEN_PREFIX } from '../auth/device-tokens';
import { env } from '../config/env';

describe('Device Token Cryptography', () => {
  describe('hashDeviceToken', () => {
    it('produces a consistent hex hash for a given string and pepper', () => {
      // The pepper is 'dummy-pepper' in our test env
      const rawToken = 'fd_device_abc123_mysecret';
      const hash1 = hashDeviceToken(rawToken);
      const hash2 = hashDeviceToken(rawToken);
      
      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/); // SHA256 hex is 64 chars
    });

    it('produces different hashes for different tokens', () => {
      const hash1 = hashDeviceToken('fd_device_1_secret');
      const hash2 = hashDeviceToken('fd_device_2_secret');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('generateDeviceToken', () => {
    it('generates a token with the correct prefix and format', () => {
      const deviceId = 'sensor-alpha-99';
      const { token } = generateDeviceToken(deviceId);

      expect(token.startsWith(DEVICE_TOKEN_PREFIX)).toBe(true);
      
      const parts = token.split('_');
      // fd_device_<deviceId>_<secret> -> ['fd', 'device', 'sensor-alpha-99', 'secrethex']
      expect(parts.length).toBe(4);
      expect(parts[0]).toBe('fd');
      expect(parts[1]).toBe('device');
      expect(parts[2]).toBe(deviceId);
      expect(parts[3].length).toBe(64); // 32 bytes random hex = 64 characters
    });

    it('returns the correct hash for the generated token', () => {
      const { token, hash } = generateDeviceToken('sensor-beta');
      const computedHash = hashDeviceToken(token);
      
      expect(hash).toBe(computedHash);
    });

    it('generates unique tokens even for the same device ID', () => {
      const { token: token1 } = generateDeviceToken('sensor');
      const { token: token2 } = generateDeviceToken('sensor');
      
      expect(token1).not.toBe(token2);
    });
  });
});
