import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import type { Request } from 'express';

jest.mock('../lib/prisma', () => ({
  prisma: {
    userProfile: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

jest.mock('../auth/jwt', () => ({
  extractBearerToken: jest.fn(),
  verifyUserToken: jest.fn(),
}));

import { prisma } from '../lib/prisma';
import { extractBearerToken, verifyUserToken } from '../auth/jwt';
import { AuthError } from '../auth/errors';
import { requireUser } from '../middleware/require-user';
import { resolveUserProfile } from '../middleware/resolve-profile';
import { requireRole } from '../middleware/require-role';
import { getUsers } from '../controllers/admin.controller';
import {
  createMockResponse,
  createNextCollector,
  handleCapturedError,
} from './helpers/mock-http';

const mockFindUnique = jest.mocked(prisma!.userProfile.findUnique);
const mockFindMany = jest.mocked(prisma!.userProfile.findMany);
const mockExtractToken = jest.mocked(extractBearerToken);
const mockVerifyToken = jest.mocked(verifyUserToken);

async function runAdminUsersRequest(authorization?: string) {
  const request = {
    headers: authorization ? { authorization } : {},
    auth: undefined,
  } as Partial<Request> & { auth?: any };
  const response = createMockResponse();

  const userNext = createNextCollector();
  await requireUser(request as Request, response as any, userNext.next);
  if (userNext.getError()) {
    handleCapturedError(userNext.getError(), request, response);
    return response;
  }

  const profileNext = createNextCollector();
  await resolveUserProfile(request as Request, response as any, profileNext.next);
  if (profileNext.getError()) {
    handleCapturedError(profileNext.getError(), request, response);
    return response;
  }

  const roleNext = createNextCollector();
  requireRole('admin')(request as Request, response as any, roleNext.next);
  if (roleNext.getError()) {
    handleCapturedError(roleNext.getError(), request, response);
    return response;
  }

  const handlerNext = createNextCollector();
  await getUsers(request as Request, response as any, handlerNext.next);
  if (handlerNext.getError()) {
    handleCapturedError(handlerNext.getError(), request, response);
  }

  return response;
}

describe('Admin Route Guards (/api/admin/*)', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('Authentication & Role Validation', () => {
    it('rejects requests missing an Authorization header (401 Unauthorized)', async () => {
      mockExtractToken.mockReturnValue(null);

      const response = await runAdminUsersRequest();

      expect(response.statusCode).toBe(401);
      expect(response.body).toEqual({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing Bearer token in Authorization header.',
        },
      });
    });

    it('rejects requests with an invalid JWT (401 Unauthorized)', async () => {
      mockExtractToken.mockReturnValue('invalid-token');
      mockVerifyToken.mockRejectedValue(AuthError.unauthorized('Invalid token'));

      const response = await runAdminUsersRequest('Bearer invalid-token');

      expect(response.statusCode).toBe(401);
    });

    it('rejects authenticated users missing a database profile (403 Forbidden)', async () => {
      mockExtractToken.mockReturnValue('valid-token');
      mockVerifyToken.mockResolvedValue({ subject: 'user-123', email: 'test@example.com' });
      mockFindUnique.mockResolvedValue(null);

      const response = await runAdminUsersRequest('Bearer valid-token');

      expect(response.statusCode).toBe(403);
      expect(response.body).toEqual({
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied. No user profile found.',
        },
      });
    });

    it('rejects authenticated users with the "viewer" role (403 Forbidden)', async () => {
      mockExtractToken.mockReturnValue('valid-token');
      mockVerifyToken.mockResolvedValue({ subject: 'user-viewer', email: 'viewer@example.com' });
      mockFindUnique.mockResolvedValue({
        id: 'user-viewer',
        email: 'viewer@example.com',
        role: 'viewer',
        status: 'active',
        fullName: 'Viewer User',
        createdAt: new Date(),
        vehicleAccess: [],
      } as any);

      const response = await runAdminUsersRequest('Bearer valid-token');

      expect(response.statusCode).toBe(403);
      expect((response.body as any).error.message).toContain('Requires one of the following roles: admin');
    });

    it('rejects authenticated users with the "driver" role (403 Forbidden)', async () => {
      mockExtractToken.mockReturnValue('valid-token');
      mockVerifyToken.mockResolvedValue({ subject: 'user-driver', email: 'driver@example.com' });
      mockFindUnique.mockResolvedValue({
        id: 'user-driver',
        email: 'driver@example.com',
        role: 'driver',
        status: 'active',
        fullName: 'Driver User',
        createdAt: new Date(),
        vehicleAccess: [
          { vehicleId: 'aa9eefcb-1be5-46a1-b76a-3a9ce6da9f70', accessLevel: 'assigned_driver' },
        ],
      } as any);

      const response = await runAdminUsersRequest('Bearer valid-token');

      expect(response.statusCode).toBe(403);
    });
  });

  describe('GET /api/admin/users (Admin Access)', () => {
    it('successfully retrieves users for an authenticated admin (200 OK)', async () => {
      mockExtractToken.mockReturnValue('admin-token');
      mockVerifyToken.mockResolvedValue({ subject: 'user-admin', email: 'admin@example.com' });
      mockFindUnique.mockResolvedValue({
        id: 'user-admin',
        email: 'admin@example.com',
        role: 'admin',
        status: 'active',
        fullName: 'Admin User',
        createdAt: new Date(),
        vehicleAccess: [],
      } as any);

      const mockUsers = [
        { id: '1', email: 'u1@test.com', fullName: 'User 1', role: 'driver', status: 'active', createdAt: new Date() },
        { id: '2', email: 'u2@test.com', fullName: 'User 2', role: 'viewer', status: 'active', createdAt: new Date() },
      ];
      mockFindMany.mockResolvedValue(mockUsers as any);

      const response = await runAdminUsersRequest('Bearer admin-token');

      expect(response.statusCode).toBe(200);
      expect(response.body).toMatchObject({
        message: 'Users retrieved successfully',
        data: mockUsers,
      });
    });
  });
});
