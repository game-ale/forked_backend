import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Request } from 'express';

jest.mock('../lib/prisma', () => ({
  prisma: {
    userProfile: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('../auth/jwt', () => ({
  extractBearerToken: jest.fn(),
  verifyUserToken: jest.fn(),
}));

import { prisma } from '../lib/prisma';
import { extractBearerToken, verifyUserToken } from '../auth/jwt';
import { requireUser } from '../middleware/require-user';
import { resolveUserProfile } from '../middleware/resolve-profile';
import { requireRole } from '../middleware/require-role';
import {
  assignDriverVehicle,
  replaceViewerVehicleAccess,
  updateUserRole,
  updateUserStatus,
} from '../controllers/admin.controller';
import {
  createMockResponse,
  createNextCollector,
  handleCapturedError,
} from './helpers/mock-http';

const mockFindProfile = jest.mocked(prisma!.userProfile.findUnique);
const mockUpdateUser = jest.mocked(prisma!.userProfile.update);
const mockTransaction = jest.mocked(prisma!.$transaction);
const mockExtractToken = jest.mocked(extractBearerToken);
const mockVerifyToken = jest.mocked(verifyUserToken);

async function authenticateAdminRequest(options: {
  authorization?: string;
  body?: Record<string, unknown>;
  params?: Record<string, string>;
}) {
  const request = {
    headers: options.authorization ? { authorization: options.authorization } : {},
    body: options.body ?? {},
    params: options.params ?? {},
    auth: undefined,
  } as Partial<Request> & { auth?: any };
  const response = createMockResponse();

  const userNext = createNextCollector();
  await requireUser(request as Request, response as any, userNext.next);
  if (userNext.getError()) {
    handleCapturedError(userNext.getError(), request, response);
    return { request, response, halted: true };
  }

  const profileNext = createNextCollector();
  await resolveUserProfile(request as Request, response as any, profileNext.next);
  if (profileNext.getError()) {
    handleCapturedError(profileNext.getError(), request, response);
    return { request, response, halted: true };
  }

  const roleNext = createNextCollector();
  requireRole('admin')(request as Request, response as any, roleNext.next);
  if (roleNext.getError()) {
    handleCapturedError(roleNext.getError(), request, response);
    return { request, response, halted: true };
  }

  return { request, response, halted: false };
}

describe('Admin user management routes', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  function mockAdminAuth() {
    mockExtractToken.mockReturnValue('admin-token');
    mockVerifyToken.mockResolvedValue({ subject: 'admin-1', email: 'admin@example.com' });
    mockFindProfile.mockResolvedValue({
      id: 'admin-1',
      email: 'admin@example.com',
      role: 'admin',
      status: 'active',
      fullName: 'Admin User',
      createdAt: new Date(),
      vehicleAccess: [],
    } as any);
  }

  it('updates a user role', async () => {
    mockAdminAuth();
    mockUpdateUser.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      role: 'driver',
      status: 'active',
    } as any);

    const { request, response, halted } = await authenticateAdminRequest({
      authorization: 'Bearer admin-token',
      params: { userId: 'user-1' },
      body: { role: 'driver' },
    });

    expect(halted).toBe(false);

    const next = createNextCollector();
    await updateUserRole(request as Request, response as any, next.next);

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      message: 'User role updated successfully',
      data: {
        id: 'user-1',
        role: 'driver',
      },
    });
  });

  it('updates a user status', async () => {
    mockAdminAuth();
    mockUpdateUser.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      role: 'viewer',
      status: 'disabled',
    } as any);

    const { request, response, halted } = await authenticateAdminRequest({
      authorization: 'Bearer admin-token',
      params: { userId: 'user-1' },
      body: { status: 'disabled' },
    });

    expect(halted).toBe(false);

    const next = createNextCollector();
    await updateUserStatus(request as Request, response as any, next.next);

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      message: 'User status updated successfully',
      data: {
        id: 'user-1',
        status: 'disabled',
      },
    });
  });

  it('replaces viewer vehicle access', async () => {
    mockAdminAuth();
    mockTransaction.mockImplementation(async (callback: any) => {
      await callback({
        userVehicleAccess: {
          deleteMany: jest.fn(),
          createMany: jest.fn(),
        },
      });
      return [];
    });

    const { request, response, halted } = await authenticateAdminRequest({
      authorization: 'Bearer admin-token',
      params: { userId: 'user-1' },
      body: {
        vehicleIds: [
          '57e1d4b5-8c9e-4569-8b65-e1fd8896f7ea',
          '2af30959-1040-44f6-8c2d-51304be9cd4e',
        ],
      },
    });

    expect(halted).toBe(false);

    const next = createNextCollector();
    await replaceViewerVehicleAccess(request as Request, response as any, next.next);

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      message: 'Viewer vehicle access updated successfully',
      data: {
        userId: 'user-1',
        accessLevel: 'viewer',
      },
    });
  });

  it('assigns a driver vehicle', async () => {
    mockAdminAuth();
    mockTransaction.mockImplementation(async (callback: any) => {
      await callback({
        userVehicleAccess: {
          deleteMany: jest.fn(),
          create: jest.fn(),
        },
      });
      return [];
    });

    const { request, response, halted } = await authenticateAdminRequest({
      authorization: 'Bearer admin-token',
      params: { userId: 'user-1' },
      body: {
        vehicleId: '57e1d4b5-8c9e-4569-8b65-e1fd8896f7ea',
      },
    });

    expect(halted).toBe(false);

    const next = createNextCollector();
    await assignDriverVehicle(request as Request, response as any, next.next);

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      message: 'Driver vehicle assignment updated successfully',
      data: {
        userId: 'user-1',
        vehicleId: '57e1d4b5-8c9e-4569-8b65-e1fd8896f7ea',
        accessLevel: 'assigned_driver',
      },
    });
  });

  it('rejects invalid role payloads', async () => {
    mockAdminAuth();

    const { request, response, halted } = await authenticateAdminRequest({
      authorization: 'Bearer admin-token',
      params: { userId: 'user-1' },
      body: { role: 'super-admin' },
    });

    expect(halted).toBe(false);

    const next = createNextCollector();
    await updateUserRole(request as Request, response as any, next.next);

    expect(response.statusCode).toBe(400);
    expect(response.body).toMatchObject({
      error: 'Validation Error',
    });
  });
});
