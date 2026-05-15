import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Request } from 'express';
import { createMockResponse } from './helpers/mock-http';

describe('Express App with Prisma configured', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('reports clientReady true when database query succeeds', async () => {
    jest.doMock('../lib/prisma', () => ({
      prisma: {
        $queryRaw: jest.fn<any>().mockResolvedValue([{ 1: 1 }]),
      },
    }));

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { healthHandler } = require('../app') as typeof import('../app');
    const response = createMockResponse();

    await healthHandler({} as Request, response as any);

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({ clientReady: true });
  });

  it('reports clientReady false when database query fails', async () => {
    jest.doMock('../lib/prisma', () => ({
      prisma: {
        $queryRaw: jest.fn<any>().mockRejectedValue(new Error('DB connection failed')),
      },
    }));

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { healthHandler } = require('../app') as typeof import('../app');
    const response = createMockResponse();

    await healthHandler({} as Request, response as any);

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({ clientReady: false });
  });
});
