import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import { requireDevice } from '../middleware/require-device';
import { prisma } from '../lib/prisma';
import { AuthError } from '../auth/errors';
import { generateDeviceToken } from '../auth/device-tokens';

jest.mock('../lib/prisma', () => ({
  prisma: {
    deviceCredential: {
      findUnique: jest.fn(),
    },
  },
}));

const mockFindUnique = jest.mocked(prisma!.deviceCredential.findUnique);

describe('requireDevice middleware', () => {
  let mockRequest: Partial<Request> & { auth?: any; headers: any };
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;

  beforeEach(() => {
    mockRequest = {
      headers: {},
    };
    mockResponse = {};
    nextFunction = jest.fn<any>();
    jest.resetAllMocks();
  });

  it('throws unauthorized if Authorization header is missing', async () => {
    await requireDevice(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(nextFunction).toHaveBeenCalledWith(expect.any(AuthError));
    const error = (nextFunction as jest.Mock).mock.calls[0][0] as AuthError;
    expect(error.code).toBe('UNAUTHORIZED');
    expect(error.message).toBe('Missing Bearer token in Authorization header.');
  });

  it('throws unauthorized if token prefix is incorrect', async () => {
    mockRequest.headers.authorization = 'Bearer random-invalid-token';
    
    await requireDevice(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(nextFunction).toHaveBeenCalledWith(expect.any(AuthError));
    const error = (nextFunction as jest.Mock).mock.calls[0][0] as AuthError;
    expect(error.message).toBe('Invalid device token format.');
  });

  it('throws unauthorized if token format is malformed (too few parts)', async () => {
    mockRequest.headers.authorization = 'Bearer fd_device_justtwo';
    
    await requireDevice(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(nextFunction).toHaveBeenCalledWith(expect.any(AuthError));
    const error = (nextFunction as jest.Mock).mock.calls[0][0] as AuthError;
    expect(error.message).toBe('Malformed device token.');
  });

  it('throws unauthorized if device credential is not found in database', async () => {
    mockRequest.headers.authorization = 'Bearer fd_device_unknown123_secret';
    mockFindUnique.mockResolvedValue(null);
    
    await requireDevice(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(nextFunction).toHaveBeenCalledWith(expect.any(AuthError));
    const error = (nextFunction as jest.Mock).mock.calls[0][0] as AuthError;
    expect(error.message).toBe('Device credential not found.');
    expect(mockFindUnique).toHaveBeenCalledWith({ where: { deviceId: 'unknown123' } });
  });

  it('throws unauthorized if the provided token does not match the database hash', async () => {
    const { token } = generateDeviceToken('sensor-001'); // Token generated with one secret
    const { hash: wrongHash } = generateDeviceToken('sensor-001'); // Simulate DB having a different rotated hash
    
    mockRequest.headers.authorization = `Bearer ${token}`;
    mockFindUnique.mockResolvedValue({
      deviceId: 'sensor-001',
      tokenHash: wrongHash,
      status: 'active',
      lastRotatedAt: new Date(),
    });

    await requireDevice(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(nextFunction).toHaveBeenCalledWith(expect.any(AuthError));
    const error = (nextFunction as jest.Mock).mock.calls[0][0] as AuthError;
    expect(error.message).toBe('Invalid device token.');
  });

  it('throws forbidden if the device is suspended', async () => {
    const { token, hash } = generateDeviceToken('sensor-002');
    
    mockRequest.headers.authorization = `Bearer ${token}`;
    mockFindUnique.mockResolvedValue({
      deviceId: 'sensor-002',
      tokenHash: hash,
      status: 'suspended', // Invalid status
      lastRotatedAt: new Date(),
    });

    await requireDevice(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(nextFunction).toHaveBeenCalledWith(expect.any(AuthError));
    const error = (nextFunction as jest.Mock).mock.calls[0][0] as AuthError;
    expect(error.code).toBe('FORBIDDEN');
    expect(error.message).toBe('Access denied. Device credential is suspended.');
  });

  it('populates req.auth and calls next() for a valid, active token', async () => {
    const { token, hash } = generateDeviceToken('sensor-003');
    
    mockRequest.headers.authorization = `Bearer ${token}`;
    mockFindUnique.mockResolvedValue({
      deviceId: 'sensor-003',
      tokenHash: hash,
      status: 'active',
      lastRotatedAt: new Date(),
    });

    await requireDevice(mockRequest as Request, mockResponse as Response, nextFunction);

    // Ensure no error was thrown
    expect(nextFunction).toHaveBeenCalledWith();
    
    // Ensure auth context is populated correctly for a device
    expect(mockRequest.auth).toEqual({
      subject: 'sensor-003',
      email: null,
      tokenType: 'device',
      role: 'viewer',
      profileResolved: true,
      vehicleIds: [],
    });
  });
});
