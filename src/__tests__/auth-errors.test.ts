import { describe, expect, it } from '@jest/globals';
import { AuthError } from '../auth/errors';

describe('AuthError', () => {
  describe('unauthorized()', () => {
    it('creates an error with 401 status and UNAUTHORIZED code', () => {
      const err = AuthError.unauthorized();
      expect(err).toBeInstanceOf(AuthError);
      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe('AuthError');
      expect(err.code).toBe('UNAUTHORIZED');
      expect(err.statusCode).toBe(401);
      expect(err.message).toBe('Missing or invalid authentication token.');
    });

    it('allows overriding the default message', () => {
      const err = AuthError.unauthorized('Custom 401 message');
      expect(err.message).toBe('Custom 401 message');
    });
  });

  describe('forbidden()', () => {
    it('creates an error with 403 status and FORBIDDEN code', () => {
      const err = AuthError.forbidden();
      expect(err).toBeInstanceOf(AuthError);
      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe('AuthError');
      expect(err.code).toBe('FORBIDDEN');
      expect(err.statusCode).toBe(403);
      expect(err.message).toBe('You do not have access to this resource.');
    });

    it('allows overriding the default message', () => {
      const err = AuthError.forbidden('Custom 403 message');
      expect(err.message).toBe('Custom 403 message');
    });
  });
});
