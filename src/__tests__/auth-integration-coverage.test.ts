import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Request } from 'express';

jest.mock('../lib/prisma', () => ({
  prisma: {
    $queryRaw: jest.fn(),
    userProfile: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    vehicle: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    vehicleLatestState: {
      findUnique: jest.fn(),
    },
    deviceCredential: {
      findUnique: jest.fn(),
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
import { healthHandler } from '../app';
import { requireUser } from '../middleware/require-user';
import { resolveUserProfile } from '../middleware/resolve-profile';
import { requireRole } from '../middleware/require-role';
import { requireVehicleAccess } from '../middleware/require-vehicle-access';
import { requireDevice } from '../middleware/require-device';
import { getUsers } from '../controllers/admin.controller';
import { listVehicles } from '../controllers/vehicle.controller';
import { ingestTelemetry } from '../controllers/telemetry.controller';
import { generateDeviceToken } from '../auth/device-tokens';
import { AuthError } from '../auth/errors';
import {
  createMockResponse,
  createNextCollector,
  handleCapturedError,
} from './helpers/mock-http';

const mockQueryRaw = jest.mocked(prisma!.$queryRaw);
const mockFindProfile = jest.mocked(prisma!.userProfile.findUnique);
const mockFindUsers = jest.mocked(prisma!.userProfile.findMany);
const mockFindVehicles = jest.mocked(prisma!.vehicle.findMany);
const mockFindVehicle = jest.mocked(prisma!.vehicle.findUnique);
const mockFindDeviceCredential = jest.mocked(prisma!.deviceCredential.findUnique);
const mockTransaction = jest.mocked(prisma!.$transaction);
const mockExtractToken = jest.mocked(extractBearerToken);
const mockVerifyToken = jest.mocked(verifyUserToken);

function buildRequest(options?: {
  authorization?: string;
  body?: Record<string, unknown>;
  params?: Record<string, string>;
}) {
  return {
    headers: options?.authorization ? { authorization: options.authorization } : {},
    body: options?.body ?? {},
    params: options?.params ?? {},
    auth: undefined,
  } as Partial<Request> & { auth?: any };
}

async function runHumanAuth(
  request: Partial<Request> & { auth?: any },
  response = createMockResponse(),
) {
  const userNext = createNextCollector();
  await requireUser(request as Request, response as any, userNext.next);
  if (userNext.getError()) {
    handleCapturedError(userNext.getError(), request, response);
    return { response, halted: true };
  }

  const profileNext = createNextCollector();
  await resolveUserProfile(request as Request, response as any, profileNext.next);
  if (profileNext.getError()) {
    handleCapturedError(profileNext.getError(), request, response);
    return { response, halted: true };
  }

  return { response, halted: false };
}

describe('Auth integration coverage', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockQueryRaw.mockResolvedValue([{ '?column?': 1 }] as any);
  });

  it('keeps /health public', async () => {
    const response = createMockResponse();

    await healthHandler({} as Request, response as any);

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({ status: 'ok' });
  });

  it('returns 403 for a disabled authenticated user', async () => {
    mockExtractToken.mockReturnValue('disabled-token');
    mockVerifyToken.mockResolvedValue({ subject: 'user-1', email: 'user@example.com' });
    mockFindProfile.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      role: 'viewer',
      status: 'disabled',
      fullName: 'Disabled User',
      createdAt: new Date(),
      vehicleAccess: [],
    } as any);

    const request = buildRequest({ authorization: 'Bearer disabled-token' });
    const response = createMockResponse();
    const { halted } = await runHumanAuth(request, response);

    expect(halted).toBe(true);
    expect(response.statusCode).toBe(403);
    expect(response.body).toEqual({
      error: {
        code: 'FORBIDDEN',
        message: 'Access denied. User account is disabled.',
      },
    });
  });

  it('prevents a viewer from accessing admin-only routes', async () => {
    mockExtractToken.mockReturnValue('viewer-token');
    mockVerifyToken.mockResolvedValue({ subject: 'viewer-1', email: 'viewer@example.com' });
    mockFindProfile.mockResolvedValue({
      id: 'viewer-1',
      email: 'viewer@example.com',
      role: 'viewer',
      status: 'active',
      fullName: 'Viewer User',
      createdAt: new Date(),
      vehicleAccess: [],
    } as any);

    const request = buildRequest({ authorization: 'Bearer viewer-token' });
    const response = createMockResponse();
    const { halted } = await runHumanAuth(request, response);

    expect(halted).toBe(false);

    const roleNext = createNextCollector();
    requireRole('admin')(request as Request, response as any, roleNext.next);
    expect(roleNext.getError()).toBeInstanceOf(AuthError);
    handleCapturedError(roleNext.getError(), request, response);

    expect(response.statusCode).toBe(403);
  });

  it('allows an admin to access protected management routes', async () => {
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
    mockFindUsers.mockResolvedValue([
      { id: '1', email: 'u1@test.com', fullName: 'User 1', role: 'driver', status: 'active', createdAt: new Date() },
    ] as any);

    const request = buildRequest({ authorization: 'Bearer admin-token' });
    const response = createMockResponse();
    const { halted } = await runHumanAuth(request, response);

    expect(halted).toBe(false);

    const roleNext = createNextCollector();
    requireRole('admin')(request as Request, response as any, roleNext.next);
    expect(roleNext.getError()).toBeUndefined();

    const handlerNext = createNextCollector();
    await getUsers(request as Request, response as any, handlerNext.next);

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({ message: 'Users retrieved successfully' });
  });

  it('blocks a driver from reading another vehicle', async () => {
    mockExtractToken.mockReturnValue('driver-token');
    mockVerifyToken.mockResolvedValue({ subject: 'driver-1', email: 'driver@example.com' });
    mockFindProfile.mockResolvedValue({
      id: 'driver-1',
      email: 'driver@example.com',
      role: 'driver',
      status: 'active',
      fullName: 'Driver User',
      createdAt: new Date(),
      vehicleAccess: [{ vehicleId: 'veh-1', accessLevel: 'assigned_driver' }],
    } as any);

    const request = buildRequest({
      authorization: 'Bearer driver-token',
      params: { vehicleId: 'veh-2' },
    });
    const response = createMockResponse();
    const { halted } = await runHumanAuth(request, response);

    expect(halted).toBe(false);

    const guardNext = createNextCollector();
    requireVehicleAccess('vehicleId')(request as Request, response as any, guardNext.next);
    expect(guardNext.getError()).toBeInstanceOf(AuthError);
    handleCapturedError(guardNext.getError(), request, response);

    expect(response.statusCode).toBe(403);
    expect((response.body as any).error.message).toBe('Access denied. You do not have access to this vehicle.');
  });

  it('allows a viewer to list assigned vehicles only', async () => {
    mockExtractToken.mockReturnValue('viewer-token');
    mockVerifyToken.mockResolvedValue({ subject: 'viewer-1', email: 'viewer@example.com' });
    mockFindProfile.mockResolvedValue({
      id: 'viewer-1',
      email: 'viewer@example.com',
      role: 'viewer',
      status: 'active',
      fullName: 'Viewer User',
      createdAt: new Date(),
      vehicleAccess: [
        { vehicleId: 'veh-1', accessLevel: 'viewer' },
        { vehicleId: 'veh-2', accessLevel: 'viewer' },
      ],
    } as any);
    mockFindVehicles.mockResolvedValue([
      { vehicleId: 'veh-1', plateNumber: 'A-123', label: 'Truck 1', tankCapacityLiters: 80, status: 'active', createdAt: new Date() },
      { vehicleId: 'veh-2', plateNumber: 'B-456', label: 'Truck 2', tankCapacityLiters: 90, status: 'active', createdAt: new Date() },
    ] as any);

    const request = buildRequest({ authorization: 'Bearer viewer-token' });
    const response = createMockResponse();
    const { halted } = await runHumanAuth(request, response);

    expect(halted).toBe(false);

    const handlerNext = createNextCollector();
    await listVehicles(request as Request, response as any, handlerNext.next);

    expect(mockFindVehicles).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { vehicleId: { in: ['veh-1', 'veh-2'] } },
      }),
    );
    expect(response.statusCode).toBe(200);
  });

  it('accepts telemetry from a valid active device token', async () => {
    const { token, hash } = generateDeviceToken('ESP32-001');
    mockExtractToken.mockReturnValue(token);
    mockFindDeviceCredential.mockResolvedValue({
      deviceId: 'ESP32-001',
      vehicleId: 'b71239c0-639a-4c2f-b44d-5c8e434f0f19',
      tokenHash: hash,
      status: 'active',
      lastRotatedAt: new Date(),
    } as any);
    mockFindVehicle.mockResolvedValue({
      vehicleId: 'b71239c0-639a-4c2f-b44d-5c8e434f0f19',
    } as any);
    mockTransaction.mockImplementation(async (callback: any) => {
      await callback({
        telemetryRaw: { create: jest.fn() },
        telemetryNormalized: { create: jest.fn() },
        vehicleLatestState: { upsert: jest.fn() },
      });
      return [];
    });

    const request = buildRequest({
      authorization: `Bearer ${token}`,
      body: {
        schemaVersion: '1.0',
        deviceId: 'ESP32-001',
        vehicleId: 'b71239c0-639a-4c2f-b44d-5c8e434f0f19',
        timestamp: new Date().toISOString(),
        fuelLevelLiters: 45.2,
        fuelLevelPercent: 56.5,
        latitude: 9.0054,
        longitude: 38.7636,
        speedKph: 60.5,
        engineStatus: 'ON',
        source: 'hardware',
      },
    });
    const response = createMockResponse();

    const authNext = createNextCollector();
    await requireDevice(request as Request, response as any, authNext.next);
    expect(authNext.getError()).toBeUndefined();

    const handlerNext = createNextCollector();
    await ingestTelemetry(request as Request, response as any, handlerNext.next);

    expect(response.statusCode).toBe(202);
    expect(response.body).toMatchObject({ message: 'Telemetry ingested successfully' });
  });

  it('rejects a human JWT on the device-only telemetry route', async () => {
    mockExtractToken.mockReturnValue('human-user-jwt');
    const request = buildRequest({
      authorization: 'Bearer human-user-jwt',
      body: {
        schemaVersion: '1.0',
        deviceId: 'ESP32-001',
        vehicleId: 'b71239c0-639a-4c2f-b44d-5c8e434f0f19',
        timestamp: new Date().toISOString(),
      },
    });
    const response = createMockResponse();

    const authNext = createNextCollector();
    await requireDevice(request as Request, response as any, authNext.next);
    expect(authNext.getError()).toBeInstanceOf(AuthError);
    handleCapturedError(authNext.getError(), request, response);

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid device token format.',
      },
    });
  });
});
