import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import { resolveUserProfile } from '../middleware/resolve-profile';
import { prisma } from '../lib/prisma';
import { AuthError } from '../auth/errors';

// Mock the prisma module deeply
jest.mock('../lib/prisma', () => ({
  prisma: {
    userProfile: {
      findUnique: jest.fn(),
    },
  },
}));

const mockFindUnique = jest.mocked(prisma!.userProfile.findUnique);

describe('resolveUserProfile middleware', () => {
  let mockRequest: Partial<Request> & { auth?: any };
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;

  beforeEach(() => {
    mockRequest = {
      auth: {
        subject: 'user-123',
        email: 'original@example.com',
        tokenType: 'user',
        profileResolved: false,
        role: 'viewer', // initial placeholder role
        vehicleIds: [],
      },
    };
    mockResponse = {};
    nextFunction = jest.fn<any>();
    jest.resetAllMocks();
  });

  it('throws unauthorized if req.auth is missing', async () => {
    mockRequest.auth = undefined;

    await resolveUserProfile(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    );

    expect(nextFunction).toHaveBeenCalledWith(expect.any(AuthError));
    const error = (nextFunction as jest.Mock).mock.calls[0][0] as AuthError;
    expect(error.code).toBe('UNAUTHORIZED');
  });

  it('throws forbidden if profile is not found in database', async () => {
    mockFindUnique.mockResolvedValue(null);

    await resolveUserProfile(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    );

    expect(nextFunction).toHaveBeenCalledWith(expect.any(AuthError));
    const error = (nextFunction as jest.Mock).mock.calls[0][0] as AuthError;
    expect(error.code).toBe('FORBIDDEN');
    expect(error.message).toBe('Access denied. No user profile found.');
  });

  it('throws forbidden if profile status is not active', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'user-123',
      email: 'user@example.com',
      fullName: 'John Doe',
      role: 'admin',
      status: 'suspended', // Not active
      createdAt: new Date(),
      vehicleAccess: [],
    } as any);

    await resolveUserProfile(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    );

    expect(nextFunction).toHaveBeenCalledWith(expect.any(AuthError));
    const error = (nextFunction as jest.Mock).mock.calls[0][0] as AuthError;
    expect(error.code).toBe('FORBIDDEN');
    expect(error.message).toBe('Access denied. User account is disabled.');
  });

  it('updates req.auth with the real database role and email for active users', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'user-123',
      email: 'database@example.com',
      fullName: 'John Doe',
      role: 'admin', // The real database role
      status: 'active',
      createdAt: new Date(),
      vehicleAccess: [
        { vehicleId: '5bcba0e9-a1d6-463b-a174-aa32844edb46', accessLevel: 'viewer' },
        { vehicleId: '31d445d4-2327-4e5d-a2c4-6fa1d9cdf21a', accessLevel: 'viewer' },
      ],
    } as any);

    await resolveUserProfile(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    );

    expect(mockRequest.auth?.role).toBe('admin');
    expect(mockRequest.auth?.profileResolved).toBe(true);
    expect(mockRequest.auth?.email).toBe('database@example.com');
    expect(mockRequest.auth?.vehicleIds).toEqual([
      '5bcba0e9-a1d6-463b-a174-aa32844edb46',
      '31d445d4-2327-4e5d-a2c4-6fa1d9cdf21a',
    ]);
    expect(nextFunction).toHaveBeenCalledWith(); // Called without error
  });

  it('throws forbidden if profile role is invalid', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'user-123',
      email: 'database@example.com',
      fullName: 'John Doe',
      role: 'super-admin',
      status: 'active',
      createdAt: new Date(),
      vehicleAccess: [],
    } as any);

    await resolveUserProfile(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    );

    expect(nextFunction).toHaveBeenCalledWith(expect.any(AuthError));
    const error = (nextFunction as jest.Mock).mock.calls[0][0] as AuthError;
    expect(error.code).toBe('FORBIDDEN');
    expect(error.message).toBe('Access denied. User role is invalid.');
  });

  it('throws forbidden if a driver is not assigned to exactly one vehicle', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'user-123',
      email: 'driver@example.com',
      fullName: 'Driver User',
      role: 'driver',
      status: 'active',
      createdAt: new Date(),
      vehicleAccess: [],
    } as any);

    await resolveUserProfile(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    );

    expect(nextFunction).toHaveBeenCalledWith(expect.any(AuthError));
    const error = (nextFunction as jest.Mock).mock.calls[0][0] as AuthError;
    expect(error.code).toBe('FORBIDDEN');
    expect(error.message).toBe('Access denied. Driver must be assigned to exactly one vehicle.');
  });

  it('allows a driver with exactly one assigned vehicle', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'user-123',
      email: 'driver@example.com',
      fullName: 'Driver User',
      role: 'driver',
      status: 'active',
      createdAt: new Date(),
      vehicleAccess: [
        { vehicleId: 'ef2ae1fa-7e7f-45ab-829d-ec4534b4ee92', accessLevel: 'assigned_driver' },
      ],
    } as any);

    await resolveUserProfile(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    );

    expect(mockRequest.auth?.role).toBe('driver');
    expect(mockRequest.auth?.vehicleIds).toEqual(['ef2ae1fa-7e7f-45ab-829d-ec4534b4ee92']);
    expect(nextFunction).toHaveBeenCalledWith();
  });
});
