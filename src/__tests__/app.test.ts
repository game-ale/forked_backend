import { describe, expect, it, jest } from '@jest/globals';
import type { Request } from 'express';
import { app, healthHandler } from '../app';
import { notFoundHandler } from '../middleware/not-found';
import { createMockResponse } from './helpers/mock-http';

jest.mock('dotenv', () => ({ config: jest.fn() }));

describe('Express App', () => {
  describe('health handler', () => {
    it('returns status ok', async () => {
      const response = createMockResponse();

      await healthHandler({} as Request, response as any);

      expect(response.statusCode).toBe(200);
      expect(response.body).toMatchObject({ status: 'ok' });
    });

    it('includes all expected response fields', async () => {
      const response = createMockResponse();

      await healthHandler({} as Request, response as any);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('appName');
      expect(response.body).toHaveProperty('environment');
      expect(response.body).toHaveProperty('prismaConfigured');
      expect(response.body).toHaveProperty('clientReady');
    });

    it('reports prismaConfigured false when SUPABASE_DB_URL is not set', async () => {
      const response = createMockResponse();

      await healthHandler({} as Request, response as any);

      expect(response.body).toMatchObject({ prismaConfigured: false });
    });

    it('reports clientReady false when no database is configured', async () => {
      const response = createMockResponse();

      await healthHandler({} as Request, response as any);

      expect(response.body).toMatchObject({ clientReady: false });
    });
  });

  describe('not found handler', () => {
    it('returns the standard 404 error body', () => {
      const response = createMockResponse();

      notFoundHandler({} as Request, response as any);

      expect(response.statusCode).toBe(404);
      expect(response.body).toEqual({
        error: {
          code: 'NOT_FOUND',
          message: 'Route not found.',
        },
      });
    });
  });

  describe('security headers', () => {
    it('does not expose x-powered-by', () => {
      expect(app.enabled('x-powered-by')).toBe(false);
    });
  });
});
