import { describe, expect, it, jest } from '@jest/globals';

import request from 'supertest';

jest.mock('dotenv', () => ({ config: jest.fn() }));

// Ensure no DB URL is configured so tests run without a real database
delete process.env.SUPABASE_DB_URL;
process.env.SUPABASE_URL = 'http://127.0.0.1:54321';
process.env.SUPABASE_ANON_KEY = 'dummy-anon-key';
process.env.AUTH_DEVICE_TOKEN_PEPPER = 'dummy-pepper';

// Import app after clearing env to get the unconfigured state
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { app } = require('../app') as typeof import('../app');

describe('Express App', () => {
  describe('GET /health', () => {
    it('responds with HTTP 200', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
    });

    it('returns status ok', async () => {
      const response = await request(app).get('/health');
      expect(response.body.status).toBe('ok');
    });

    it('includes all expected response fields', async () => {
      const response = await request(app).get('/health');
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('appName');
      expect(response.body).toHaveProperty('environment');
      expect(response.body).toHaveProperty('prismaConfigured');
      expect(response.body).toHaveProperty('clientReady');
    });

    it('reports prismaConfigured false when SUPABASE_DB_URL is not set', async () => {
      const response = await request(app).get('/health');
      expect(response.body.prismaConfigured).toBe(false);
    });

    it('reports clientReady false when no database is configured', async () => {
      const response = await request(app).get('/health');
      expect(response.body.clientReady).toBe(false);
    });
  });

  describe('unknown routes', () => {
    it('returns 404 for an unregistered path', async () => {
      const response = await request(app).get('/not-a-real-route');
      expect(response.status).toBe(404);
    });

    it('returns the standard not found error body', async () => {
      const response = await request(app).get('/not-a-real-route');
      expect(response.body).toEqual({
        error: {
          code: 'NOT_FOUND',
          message: 'Route not found.',
        },
      });
    });
  });

  describe('security headers', () => {
    it('does not expose x-powered-by', async () => {
      const response = await request(app).get('/health');
      expect(response.headers['x-powered-by']).toBeUndefined();
    });
  });
});
