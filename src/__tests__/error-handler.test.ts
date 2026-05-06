import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { NextFunction, Request, Response } from 'express';
import { errorHandler } from '../middleware/error-handler';

describe('errorHandler', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;

  beforeEach(() => {
    mockRequest = {};
    mockResponse = {
      status: jest.fn<any>().mockReturnThis(),
      json: jest.fn<any>(),
    };
    nextFunction = jest.fn<any>();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('logs the error and returns 500 status with generic error message', () => {
    const error = new Error('Test error');
    
    errorHandler(
      error,
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    );

    expect(console.error).toHaveBeenCalledWith('Unhandled request error', error);
    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred.',
      },
    });
  });

  it('handles AuthError without logging and returns the correct status and JSON', () => {
    const { AuthError } = require('../auth/errors');
    const authErr = AuthError.unauthorized('Custom test unauth');

    errorHandler(
      authErr,
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    );

    expect(console.error).not.toHaveBeenCalled();
    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Custom test unauth',
      },
    });
  });

  it('handles forbidden AuthError correctly', () => {
    const { AuthError } = require('../auth/errors');
    const authErr = AuthError.forbidden('Custom test forbidden');

    errorHandler(
      authErr,
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    );

    expect(console.error).not.toHaveBeenCalled();
    expect(mockResponse.status).toHaveBeenCalledWith(403);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: {
        code: 'FORBIDDEN',
        message: 'Custom test forbidden',
      },
    });
  });
});
