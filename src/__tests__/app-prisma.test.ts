import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';

describe('Express App with Prisma configured', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('reports clientReady true when database query succeeds', async () => {
    jest.mock('../lib/prisma', () => ({
      prisma: {
        $queryRaw: jest.fn<any>().mockResolvedValue([{ 1: 1 }]),
      },
    }));
    
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { app } = require('../app');

    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.clientReady).toBe(true);
  });

  it('reports clientReady false when database query fails', async () => {
    jest.mock('../lib/prisma', () => ({
      prisma: {
        $queryRaw: jest.fn<any>().mockRejectedValue(new Error('DB connection failed')),
      },
    }));
    
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { app } = require('../app');

    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.clientReady).toBe(false);
  });
});
