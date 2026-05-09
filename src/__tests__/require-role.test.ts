import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import { requireRole } from '../middleware/require-role';
import { AuthError } from '../auth/errors';
import { AppRole } from '../auth/types';

describe('requireRole middleware', () => {
  let mockRequest: Partial<Request> & { auth?: any };
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;

  beforeEach(() => {
    mockRequest = {
      auth: {
        subject: 'user-123',
        email: 'test@example.com',
        tokenType: 'user',
        profileResolved: true,
        role: 'driver', // Default to driver for testing
        vehicleIds: [],
      },
    };
    mockResponse = {};
    nextFunction = jest.fn<any>();
    jest.resetAllMocks();
  });

  it('throws unauthorized if req.auth is missing entirely', () => {
    mockRequest.auth = undefined;
    
    const middleware = requireRole('admin');
    middleware(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(nextFunction).toHaveBeenCalledWith(expect.any(AuthError));
    const error = (nextFunction as jest.Mock).mock.calls[0][0] as AuthError;
    expect(error.code).toBe('UNAUTHORIZED');
  });

  it('throws unauthorized if resolveUserProfile did not run yet', () => {
    mockRequest.auth = {
      ...mockRequest.auth,
      role: 'viewer',
      profileResolved: false,
    };

    const middleware = requireRole('viewer');
    middleware(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(nextFunction).toHaveBeenCalledWith(expect.any(AuthError));
    const error = (nextFunction as jest.Mock).mock.calls[0][0] as AuthError;
    expect(error.code).toBe('UNAUTHORIZED');
    expect(error.message).toContain('Ensure resolveUserProfile runs first.');
  });

  it('throws forbidden if user role is not in the allowed list', () => {
    // User is a 'driver'
    const middleware = requireRole('admin'); // Only admin allowed
    middleware(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(nextFunction).toHaveBeenCalledWith(expect.any(AuthError));
    const error = (nextFunction as jest.Mock).mock.calls[0][0] as AuthError;
    expect(error.code).toBe('FORBIDDEN');
    expect(error.message).toContain('Access denied. Requires one of the following roles: admin');
  });

  it('calls next() if user role is exactly the allowed role', () => {
    const middleware = requireRole('driver');
    middleware(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(nextFunction).toHaveBeenCalledWith(); // success
  });

  it('calls next() if user role is one of multiple allowed roles', () => {
    mockRequest.auth!.role = 'admin';
    
    // Both admin and driver are allowed
    const middleware = requireRole('driver', 'admin');
    middleware(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(nextFunction).toHaveBeenCalledWith(); // success
  });

  it('throws immediately if configured without allowed roles', () => {
    expect(() => requireRole()).toThrow('requireRole must be called with at least one allowed role.');
  });
});
