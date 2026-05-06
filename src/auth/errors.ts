export type AuthErrorCode = 'UNAUTHORIZED' | 'FORBIDDEN';

export class AuthError extends Error {
  public code: AuthErrorCode;
  public statusCode: number;

  constructor(code: AuthErrorCode, message: string) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.statusCode = code === 'UNAUTHORIZED' ? 401 : 403;
  }

  static unauthorized(message = 'Missing or invalid authentication token.') {
    return new AuthError('UNAUTHORIZED', message);
  }

  static forbidden(message = 'You do not have access to this resource.') {
    return new AuthError('FORBIDDEN', message);
  }
}
