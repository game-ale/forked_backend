import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Request } from 'express';

jest.mock('../lib/prisma', () => ({
  prisma: {
    userProfile: {
      findUnique: jest.fn(),
    },
    deviceCredential: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
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
  createDeviceCredential,
  disableDeviceCredential,
  rotateDeviceCredential,
} from '../controllers/admin.controller';
import {
  createMockResponse,
  createNextCollector,
  handleCapturedError,
} from './helpers/mock-http';

const mockFindProfile = jest.mocked(prisma!.userProfile.findUnique);
const mockCreateCredential = jest.mocked((prisma!.deviceCredential as any).create);
const mockFindCredential = jest.mocked((prisma!.deviceCredential as any).findUnique);
const mockUpdateCredential = jest.mocked((prisma!.deviceCredential as any).update);
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

describe('Admin device management routes', () => {
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

  it('creates a device credential and returns the plaintext token once', async () => {
    mockAdminAuth();
    mockCreateCredential.mockResolvedValue({
      deviceId: 'ESP32-001',
      vehicleId: '2f4787a9-5a6d-47fd-b67f-eaf6ba0c4f24',
      status: 'active',
      tokenHash: 'stored-hash',
    });

    const { request, response, halted } = await authenticateAdminRequest({
      authorization: 'Bearer admin-token',
      body: {
        deviceId: 'ESP32-001',
        vehicleId: '2f4787a9-5a6d-47fd-b67f-eaf6ba0c4f24',
      },
    });

    expect(halted).toBe(false);

    const handlerNext = createNextCollector();
    await createDeviceCredential(request as Request, response as any, handlerNext.next);

    expect(response.statusCode).toBe(201);
    expect(response.body).toMatchObject({
      message: 'Device credential created successfully',
      data: {
        deviceId: 'ESP32-001',
        vehicleId: '2f4787a9-5a6d-47fd-b67f-eaf6ba0c4f24',
        status: 'active',
      },
    });
    expect((response.body as any).data.token).toMatch(/^fd_device_ESP32-001_/);
    expect((response.body as any).data.tokenHash).toBeUndefined();
  });

  it('rotates a device credential and returns a fresh plaintext token', async () => {
    mockAdminAuth();
    mockFindCredential.mockResolvedValue({
      deviceId: 'ESP32-001',
      vehicleId: '2f4787a9-5a6d-47fd-b67f-eaf6ba0c4f24',
      status: 'active',
      tokenHash: 'old-hash',
    });
    mockUpdateCredential.mockResolvedValue({
      deviceId: 'ESP32-001',
      status: 'active',
      tokenHash: 'new-hash',
    });

    const { request, response, halted } = await authenticateAdminRequest({
      authorization: 'Bearer admin-token',
      params: {
        deviceId: 'ESP32-001',
      },
    });

    expect(halted).toBe(false);

    const handlerNext = createNextCollector();
    await rotateDeviceCredential(request as Request, response as any, handlerNext.next);

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      message: 'Device credential rotated successfully',
      data: {
        deviceId: 'ESP32-001',
        vehicleId: '2f4787a9-5a6d-47fd-b67f-eaf6ba0c4f24',
        status: 'active',
      },
    });
    expect((response.body as any).data.token).toMatch(/^fd_device_ESP32-001_/);
    expect((response.body as any).data.tokenHash).toBeUndefined();
  });

  it('disables a device credential without returning a token or hash', async () => {
    mockAdminAuth();
    mockFindCredential.mockResolvedValue({
      deviceId: 'ESP32-001',
      vehicleId: '2f4787a9-5a6d-47fd-b67f-eaf6ba0c4f24',
      status: 'active',
      tokenHash: 'old-hash',
    });
    mockUpdateCredential.mockResolvedValue({
      deviceId: 'ESP32-001',
      status: 'disabled',
      tokenHash: 'old-hash',
    });

    const { request, response, halted } = await authenticateAdminRequest({
      authorization: 'Bearer admin-token',
      params: {
        deviceId: 'ESP32-001',
      },
    });

    expect(halted).toBe(false);

    const handlerNext = createNextCollector();
    await disableDeviceCredential(request as Request, response as any, handlerNext.next);

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      message: 'Device credential disabled successfully',
      data: {
        deviceId: 'ESP32-001',
        vehicleId: '2f4787a9-5a6d-47fd-b67f-eaf6ba0c4f24',
        status: 'disabled',
      },
    });
  });

  it('rejects invalid create payloads', async () => {
    mockAdminAuth();

    const { request, response, halted } = await authenticateAdminRequest({
      authorization: 'Bearer admin-token',
      body: {
        deviceId: '',
        vehicleId: 'not-a-uuid',
      },
    });

    expect(halted).toBe(false);

    const handlerNext = createNextCollector();
    await createDeviceCredential(request as Request, response as any, handlerNext.next);

    expect(response.statusCode).toBe(400);
    expect(response.body).toMatchObject({
      error: 'Validation Error',
    });
  });
});
