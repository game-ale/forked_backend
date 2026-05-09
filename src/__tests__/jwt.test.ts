import { describe, expect, it } from '@jest/globals';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AuthError } from '../auth/errors';
import { extractBearerToken, verifyUserToken } from '../auth/jwt';

describe('JWT Utilities', () => {
  describe('extractBearerToken', () => {
    it('returns null if header is undefined', () => {
      expect(extractBearerToken(undefined)).toBeNull();
    });

    it('returns null if header does not start with Bearer', () => {
      expect(extractBearerToken('Basic some-token')).toBeNull();
    });

    it('returns the token when correctly formatted', () => {
      expect(extractBearerToken('Bearer my-secret-token')).toBe('my-secret-token');
    });

    it('returns null if header is malformed', () => {
      expect(extractBearerToken('Bearer')).toBeNull();
    });
  });

  describe('verifyUserToken', () => {
    const secretKey = env.supabaseJwtSecret || '';

    const createValidToken = (payload: Record<string, unknown> = {}) => {
      return jwt.sign(
        { sub: 'user-123', email: 'test@example.com', ...payload },
        secretKey,
        { algorithm: 'HS256', audience: 'authenticated', expiresIn: '1h' }
      );
    };

    it('successfully verifies a valid Supabase HS256 token', async () => {
      const token = createValidToken();
      const result = await verifyUserToken(token);
      
      expect(result).toEqual({
        subject: 'user-123',
        email: 'test@example.com',
      });
    });

    it('throws AuthError if token has wrong audience', async () => {
      const token = jwt.sign(
        { sub: 'user-123' },
        secretKey,
        { algorithm: 'HS256', audience: 'wrong-audience', expiresIn: '1h' }
      );

      await expect(verifyUserToken(token)).rejects.toThrow(AuthError);
      await expect(verifyUserToken(token)).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired token.',
      });
    });

    it('throws AuthError if token is expired', async () => {
      // Create token that expired 1 hour ago
      const token = jwt.sign(
        { sub: 'user-123', exp: Math.floor(Date.now() / 1000) - 3600 },
        secretKey,
        { algorithm: 'HS256', audience: 'authenticated' }
      );

      await expect(verifyUserToken(token)).rejects.toThrow(AuthError);
    });

    it('throws AuthError if subject claim is missing', async () => {
      const token = jwt.sign(
        { email: 'test@example.com' },
        secretKey,
        { algorithm: 'HS256', audience: 'authenticated', expiresIn: '1h' }
      );

      await expect(verifyUserToken(token)).rejects.toThrow('Token is missing subject claim.');
    });

    it('handles missing email claim correctly', async () => {
      const token = jwt.sign(
        { sub: 'user-456' },
        secretKey,
        { algorithm: 'HS256', audience: 'authenticated', expiresIn: '1h' }
      );

      const result = await verifyUserToken(token);
      
      expect(result).toEqual({
        subject: 'user-456',
        email: null,
      });
    });
  });
});
