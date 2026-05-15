import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Request } from 'express';

jest.mock('../lib/prisma', () => ({
  prisma: {
    userProfile: {
      findUnique: jest.fn(),
    },
    vehicle: {
      findMany: jest.fn(),
    },
    vehicleLatestState: {
      findUnique: jest.fn(),
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
import { requireVehicleAccess } from '../middleware/require-vehicle-access';
import { getVehicleLatestState, listVehicles } from '../controllers/vehicle.controller';
import {
  createMockResponse,
  createNextCollector,
  handleCapturedError,
} from './helpers/mock-http';

const mockFindProfile = jest.mocked(prisma!.userProfile.findUnique);
const mockFindVehicles = jest.mocked(prisma!.vehicle.findMany);
const mockFindLatestState = jest.mocked(prisma!.vehicleLatestState.findUnique);
const mockExtractToken = jest.mocked(extractBearerToken);
const mockVerifyToken = jest.mocked(verifyUserToken);

async function authenticateRequest(options: {
  authorization?: string;
  params?: Record<string, string>;
}) {
  const request = {
    headers: options.authorization ? { authorization: options.authorization } : {},
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

  return { request, response, halted: false };
}

describe('Vehicle read routes', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('GET /api/vehicles', () => {
    it('returns only assigned vehicles for a viewer', async () => {
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

      const { request, response, halted } = await authenticateRequest({
        authorization: 'Bearer viewer-token',
      });

      expect(halted).toBe(false);

      const handlerNext = createNextCollector();
      await listVehicles(request as Request, response as any, handlerNext.next);

      expect(mockFindVehicles).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            vehicleId: {
              in: ['veh-1', 'veh-2'],
            },
          },
        }),
      );
      expect(response.statusCode).toBe(200);
      expect(response.body).toMatchObject({
        message: 'Vehicles retrieved successfully',
      });
    });

    it('returns all vehicles for an admin', async () => {
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
      mockFindVehicles.mockResolvedValue([] as any);

      const { request, response, halted } = await authenticateRequest({
        authorization: 'Bearer admin-token',
      });

      expect(halted).toBe(false);

      const handlerNext = createNextCollector();
      await listVehicles(request as Request, response as any, handlerNext.next);

      expect(mockFindVehicles).toHaveBeenCalledWith(
        expect.objectContaining({
          where: undefined,
        }),
      );
      expect(response.statusCode).toBe(200);
    });
  });

  describe('GET /api/vehicles/:vehicleId/latest', () => {
    it('rejects access to an unassigned vehicle for a driver', async () => {
      mockExtractToken.mockReturnValue('driver-token');
      mockVerifyToken.mockResolvedValue({ subject: 'driver-1', email: 'driver@example.com' });
      mockFindProfile.mockResolvedValue({
        id: 'driver-1',
        email: 'driver@example.com',
        role: 'driver',
        status: 'active',
        fullName: 'Driver User',
        createdAt: new Date(),
        vehicleAccess: [
          { vehicleId: 'veh-1', accessLevel: 'assigned_driver' },
        ],
      } as any);

      const { request, response, halted } = await authenticateRequest({
        authorization: 'Bearer driver-token',
        params: { vehicleId: 'veh-2' },
      });

      expect(halted).toBe(false);

      const guardNext = createNextCollector();
      requireVehicleAccess('vehicleId')(request as Request, response as any, guardNext.next);
      expect(guardNext.getError()).toBeDefined();
      handleCapturedError(guardNext.getError(), request, response);

      expect(response.statusCode).toBe(403);
      expect((response.body as any).error.message).toBe('Access denied. You do not have access to this vehicle.');
    });

    it('returns the latest state for an assigned vehicle', async () => {
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
        ],
      } as any);
      mockFindLatestState.mockResolvedValue({
        vehicleId: 'veh-1',
        lastSeenAt: new Date(),
        fuelLevelLiters: 44.5,
        fuelLevelPercent: 55,
        latitude: 9.0,
        longitude: 38.7,
        engineStatus: 'ON',
        deviceStatus: 'online',
        currentAlertLevel: 'normal',
      } as any);

      const { request, response, halted } = await authenticateRequest({
        authorization: 'Bearer viewer-token',
        params: { vehicleId: 'veh-1' },
      });

      expect(halted).toBe(false);

      const guardNext = createNextCollector();
      requireVehicleAccess('vehicleId')(request as Request, response as any, guardNext.next);
      expect(guardNext.getError()).toBeUndefined();

      const handlerNext = createNextCollector();
      await getVehicleLatestState(request as Request, response as any, handlerNext.next);

      expect(mockFindLatestState).toHaveBeenCalledWith({
        where: { vehicleId: 'veh-1' },
        select: expect.any(Object),
      });
      expect(response.statusCode).toBe(200);
      expect(response.body).toMatchObject({
        message: 'Vehicle latest state retrieved successfully',
      });
    });
  });
});
