import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import type { Request } from 'express';

jest.mock('../lib/prisma', () => ({
  prisma: {
    deviceCredential: {
      findUnique: jest.fn(),
    },
    vehicle: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

import { prisma } from '../lib/prisma';
import { generateDeviceToken } from '../auth/device-tokens';
import { requireDevice } from '../middleware/require-device';
import { ingestTelemetry } from '../controllers/telemetry.controller';
import {
  createMockResponse,
  createNextCollector,
  handleCapturedError,
} from './helpers/mock-http';

const mockDeviceFindUnique = jest.mocked(prisma!.deviceCredential.findUnique);
const mockVehicleFindUnique = jest.mocked(prisma!.vehicle.findUnique);
const mockTransaction = jest.mocked(prisma!.$transaction);

async function runTelemetryRequest(
  payload: Record<string, unknown>,
  authorization?: string,
) {
  const request = {
    headers: authorization ? { authorization } : {},
    body: payload,
    auth: undefined,
  } as Partial<Request> & { auth?: any };
  const response = createMockResponse();

  const authNext = createNextCollector();
  await requireDevice(request as Request, response as any, authNext.next);
  if (authNext.getError()) {
    handleCapturedError(authNext.getError(), request, response);
    return response;
  }

  const handlerNext = createNextCollector();
  await ingestTelemetry(request as Request, response as any, handlerNext.next);
  if (handlerNext.getError()) {
    handleCapturedError(handlerNext.getError(), request, response);
  }

  return response;
}

describe('POST /api/telemetry', () => {
  let validToken: string;
  let validHash: string;

  beforeEach(() => {
    jest.resetAllMocks();
    const tokenData = generateDeviceToken('ESP32-TEST');
    validToken = tokenData.token;
    validHash = tokenData.hash;

    mockDeviceFindUnique.mockResolvedValue({
      deviceId: 'ESP32-TEST',
      vehicleId: 'b71239c0-639a-4c2f-b44d-5c8e434f0f19',
      tokenHash: validHash,
      status: 'active',
      lastRotatedAt: new Date(),
    } as any);

    mockVehicleFindUnique.mockResolvedValue({
      vehicleId: 'b71239c0-639a-4c2f-b44d-5c8e434f0f19',
    } as any);

    mockTransaction.mockImplementation(async (callback: any) => {
      const txClient = {
        telemetryRaw: { create: jest.fn() },
        telemetryNormalized: { create: jest.fn() },
        vehicleLatestState: { upsert: jest.fn() },
      };
      await callback(txClient as any);
      return [];
    });
  });

  const validPayload = {
    schemaVersion: '1.0',
    deviceId: 'ESP32-TEST',
    vehicleId: 'b71239c0-639a-4c2f-b44d-5c8e434f0f19',
    timestamp: new Date().toISOString(),
    fuelLevelLiters: 45.2,
    fuelLevelPercent: 56.5,
    latitude: 9.0054,
    longitude: 38.7636,
    speedKph: 60.5,
    engineStatus: 'ON',
    source: 'hardware',
  };

  it('rejects requests missing the Authorization header', async () => {
    const response = await runTelemetryRequest(validPayload);

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing Bearer token in Authorization header.',
      },
    });
  });

  it('rejects requests with validation errors (missing required fields)', async () => {
    const invalidPayload = { ...validPayload };
    // @ts-expect-error forcing missing field
    delete invalidPayload.timestamp;

    const response = await runTelemetryRequest(invalidPayload, `Bearer ${validToken}`);

    expect(response.statusCode).toBe(400);
    expect(response.body).toMatchObject({
      error: 'Validation Error',
    });
  });

  it('rejects requests where the device attempts to spoof another device ID', async () => {
    const spoofPayload = { ...validPayload, deviceId: 'HACKED-DEVICE' };

    const response = await runTelemetryRequest(spoofPayload, `Bearer ${validToken}`);

    expect(response.statusCode).toBe(403);
    expect((response.body as any).error.message).toContain('Spoofing detected');
  });

  it('rejects requests where the device submits telemetry for an unassigned vehicleId', async () => {
    mockDeviceFindUnique.mockResolvedValue({
      deviceId: 'ESP32-TEST',
      vehicleId: '790ad376-1a80-4ef4-9b0c-4f89bfb83afb',
      tokenHash: validHash,
      status: 'active',
      lastRotatedAt: new Date(),
    } as any);

    const response = await runTelemetryRequest(validPayload, `Bearer ${validToken}`);

    expect(response.statusCode).toBe(403);
    expect((response.body as any).error.message).toContain('is not assigned to vehicle');
  });

  it('rejects requests if the vehicleId does not exist in the database', async () => {
    mockVehicleFindUnique.mockResolvedValue(null);

    const response = await runTelemetryRequest(validPayload, `Bearer ${validToken}`);

    expect(response.statusCode).toBe(400);
    expect(response.body).toMatchObject({
      error: 'Bad Request',
    });
    expect((response.body as any).message).toContain('does not exist or is not registered');
  });

  it('successfully ingests telemetry and returns 202 Accepted', async () => {
    const response = await runTelemetryRequest(validPayload, `Bearer ${validToken}`);

    expect(response.statusCode).toBe(202);
    expect(response.body).toMatchObject({
      message: 'Telemetry ingested successfully',
      deviceId: 'ESP32-TEST',
      vehicleId: 'b71239c0-639a-4c2f-b44d-5c8e434f0f19',
    });
    expect(mockTransaction).toHaveBeenCalled();
  });
});
