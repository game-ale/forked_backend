import { beforeEach, describe, expect, it, jest } from '@jest/globals';

describe('prisma client', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('initializes PrismaClient when env.prismaConfigured is true', () => {
    jest.mock('../config/env', () => ({
      env: {
        prismaConfigured: true,
      },
    }));
    
    const mockPrismaClient = jest.fn();
    jest.mock('@prisma/client', () => ({
      PrismaClient: mockPrismaClient,
    }));

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { prisma } = require('../lib/prisma');
    
    expect(mockPrismaClient).toHaveBeenCalled();
    expect(prisma).toBeDefined();
    expect(prisma).not.toBeNull();
  });

  it('exports null when env.prismaConfigured is false', () => {
    jest.mock('../config/env', () => ({
      env: {
        prismaConfigured: false,
      },
    }));

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { prisma } = require('../lib/prisma');
    
    expect(prisma).toBeNull();
  });
});
