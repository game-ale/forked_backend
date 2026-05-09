import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import request from 'supertest';

// Mock prisma FIRST before importing the app
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

// Import after mocking
import { app } from '../app';
import { prisma } from '../lib/prisma';
import { generateDeviceToken } from '../auth/device-tokens';

const mockDeviceFindUnique = jest.mocked(prisma!.deviceCredential.findUnique);
const mockVehicleFindUnique = jest.mocked(prisma!.vehicle.findUnique);
const mockTransaction = jest.mocked(prisma!.$transaction);

describe('POST /api/telemetry', () => {
  let validToken: string;
  let validHash: string;

  beforeEach(() => {
    jest.resetAllMocks();
    const tokenData = generateDeviceToken('ESP32-TEST');
    validToken = tokenData.token;
    validHash = tokenData.hash;

    // Default mock behavior for a successful device auth
    mockDeviceFindUnique.mockResolvedValue({
      deviceId: 'ESP32-TEST',
      tokenHash: validHash,
      status: 'active',
      lastRotatedAt: new Date(),
    });

    // Default mock behavior for a successful vehicle lookup
    mockVehicleFindUnique.mockResolvedValue({
      vehicleId: 'b71239c0-639a-4c2f-b44d-5c8e434f0f19',
      licensePlate: 'TEST-123',
      make: 'Toyota',
      model: 'Hilux',
      year: 2023,
      fuelCapacityLiters: 80,
      createdAt: new Date(),
    } as any);

    // Mock transaction to just execute the callback
    mockTransaction.mockImplementation(async (callback: any) => {
      // Create a mock transaction client
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
    const response = await request(app)
      .post('/api/telemetry')
      .send(validPayload);

    expect(response.status).toBe(401);
    expect(response.body.error.message).toBe('Missing Bearer token in Authorization header.');
  });

  it('rejects requests with validation errors (missing required fields)', async () => {
    const invalidPayload = { ...validPayload };
    // @ts-expect-error forcing missing field
    delete invalidPayload.timestamp;

    const response = await request(app)
      .post('/api/telemetry')
      .set('Authorization', `Bearer ${validToken}`)
      .send(invalidPayload);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Validation Error');
  });

  it('rejects requests where the device attempts to spoof another device ID', async () => {
    const spoofPayload = { ...validPayload, deviceId: 'HACKED-DEVICE' };

    const response = await request(app)
      .post('/api/telemetry')
      .set('Authorization', `Bearer ${validToken}`) // Token is for ESP32-TEST
      .send(spoofPayload);

    expect(response.status).toBe(403);
    expect(response.body.error.message).toContain('Spoofing detected');
  });

  it('rejects requests if the vehicleId does not exist in the database', async () => {
    mockVehicleFindUnique.mockResolvedValue(null); // Vehicle not found

    const response = await request(app)
      .post('/api/telemetry')
      .set('Authorization', `Bearer ${validToken}`)
      .send(validPayload);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Bad Request');
    expect(response.body.message).toContain('does not exist or is not registered');
  });

  it('successfully ingests telemetry and returns 202 Accepted', async () => {
    const response = await request(app)
      .post('/api/telemetry')
      .set('Authorization', `Bearer ${validToken}`)
      .send(validPayload);

    expect(response.status).toBe(202);
    expect(response.body.message).toBe('Telemetry ingested successfully');
    expect(mockTransaction).toHaveBeenCalled();
  });
});
