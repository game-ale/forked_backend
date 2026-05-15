import { jest } from '@jest/globals';
import type { NextFunction, Request, Response } from 'express';
import { errorHandler } from '../../middleware/error-handler';

export type MockResponse = Partial<Response> & {
  statusCode: number;
  body: unknown;
  headersSent: boolean;
};

export function createMockResponse(): MockResponse {
  const response: MockResponse = {
    statusCode: 200,
    body: undefined,
    headersSent: false,
  };

  response.status = jest.fn((code: number) => {
    response.statusCode = code;
    return response as Response;
  }) as Response['status'];

  response.json = jest.fn((body: unknown) => {
    response.body = body;
    response.headersSent = true;
    return response as Response;
  }) as Response['json'];

  return response;
}

export function createNextCollector() {
  let capturedError: unknown;

  const nextFunction: NextFunction = ((
    error?: unknown,
  ) => {
    capturedError = error;
  }) as NextFunction;

  const next = jest.fn(nextFunction) as unknown as NextFunction;

  return {
    next,
    getError: () => capturedError,
  };
}

export function handleCapturedError(
  error: unknown,
  req: Partial<Request>,
  res: MockResponse,
) {
  errorHandler(error, req as Request, res as Response, jest.fn() as NextFunction);
}
