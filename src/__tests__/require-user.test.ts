import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import { requireUser } from '../middleware/require-user';
import { AuthError } from '../auth/errors';
import * as jwtUtils from '../auth/jwt';

// Mock the jwt module
jest.mock('../auth/jwt');

const mockExtractBearerToken = jest.mocked(jwtUtils.extractBearerToken);
const mockVerifyUserToken = jest.mocked(jwtUtils.verifyUserToken);

describe('requireUser middleware', () => {
  let mockRequest: Partial<Request>;
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

  it('throws unauthorized if token is missing', async () => {
    mockExtractBearerToken.mockReturnValue(null);

    await requireUser(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    );

    expect(nextFunction).toHaveBeenCalledWith(expect.any(AuthError));
    const error = (nextFunction as jest.Mock).mock.calls[0][0] as AuthError;
    expect(error.code).toBe('UNAUTHORIZED');
    expect(error.message).toBe('Missing Bearer token in Authorization header.');
  });

  it('throws the error from verifyUserToken if verification fails', async () => {
    mockExtractBearerToken.mockReturnValue('invalid-token');
    mockVerifyUserToken.mockRejectedValue(AuthError.unauthorized('Invalid or expired token.'));

    await requireUser(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    );

    expect(nextFunction).toHaveBeenCalledWith(expect.any(AuthError));
    const error = (nextFunction as jest.Mock).mock.calls[0][0] as AuthError;
    expect(error.code).toBe('UNAUTHORIZED');
    expect(error.message).toBe('Invalid or expired token.');
  });

  it('populates req.auth and calls next() if token is valid', async () => {
    mockExtractBearerToken.mockReturnValue('valid-token');
    mockVerifyUserToken.mockResolvedValue({
      subject: 'user-123',
      email: 'test@example.com',
    });

    await requireUser(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    );

    // It should populate the req.auth object
    expect((mockRequest as any).auth).toEqual({
      subject: 'user-123',
      email: 'test@example.com',
      tokenType: 'user',
      role: 'viewer', // default placeholder
      vehicleIds: [],
    });

    // next() should be called with no arguments
    expect(nextFunction).toHaveBeenCalledWith();
  });
});
