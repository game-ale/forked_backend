import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import { requireVehicleAccess } from '../middleware/require-vehicle-access';
import { AuthError } from '../auth/errors';

describe('requireVehicleAccess middleware', () => {
  let mockRequest: Partial<Request> & { auth?: any; params: Record<string, string> };
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;

  beforeEach(() => {
    mockRequest = {
      params: {
        vehicleId: 'veh-123',
      },
      auth: {
        subject: 'user-123',
        email: 'test@example.com',
        tokenType: 'user',
        profileResolved: true,
        role: 'viewer',
        vehicleIds: ['veh-123'],
      },
    };
    mockResponse = {};
    nextFunction = jest.fn<any>();
    jest.resetAllMocks();
  });

  it('throws unauthorized if auth context is missing', () => {
    mockRequest.auth = undefined;

    const middleware = requireVehicleAccess('vehicleId');
    middleware(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(nextFunction).toHaveBeenCalledWith(expect.any(AuthError));
    const error = (nextFunction as jest.Mock).mock.calls[0][0] as AuthError;
    expect(error.code).toBe('UNAUTHORIZED');
  });

  it('throws forbidden if the route param is missing', () => {
    mockRequest.params = {};

    const middleware = requireVehicleAccess('vehicleId');
    middleware(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(nextFunction).toHaveBeenCalledWith(expect.any(AuthError));
    const error = (nextFunction as jest.Mock).mock.calls[0][0] as AuthError;
    expect(error.code).toBe('FORBIDDEN');
    expect(error.message).toContain('Missing vehicle route param');
  });

  it('allows admin access even without a scoped vehicleIds match', () => {
    mockRequest.auth!.role = 'admin';
    mockRequest.auth!.vehicleIds = [];

    const middleware = requireVehicleAccess('vehicleId');
    middleware(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(nextFunction).toHaveBeenCalledWith();
  });

  it('allows viewer access for an assigned vehicle', () => {
    const middleware = requireVehicleAccess('vehicleId');
    middleware(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(nextFunction).toHaveBeenCalledWith();
  });

  it('rejects access to an unassigned vehicle', () => {
    mockRequest.params.vehicleId = 'veh-999';

    const middleware = requireVehicleAccess('vehicleId');
    middleware(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(nextFunction).toHaveBeenCalledWith(expect.any(AuthError));
    const error = (nextFunction as jest.Mock).mock.calls[0][0] as AuthError;
    expect(error.code).toBe('FORBIDDEN');
    expect(error.message).toBe('Access denied. You do not have access to this vehicle.');
  });

  it('throws immediately if configured without a route param name', () => {
    expect(() => requireVehicleAccess('')).toThrow(
      'requireVehicleAccess must be called with a route param name.',
    );
  });
});
