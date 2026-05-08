import { NextFunction, Request, Response } from 'express';
import { extractBearerToken, verifyUserToken } from '../auth/jwt';
import { AuthError } from '../auth/errors';

/**
 * Express middleware that verifies the request contains a valid Supabase user JWT.
 * If valid, it populates `req.auth` with the subject and basic context.
 * If invalid, missing, or expired, it throws an AuthError (401 Unauthorized) 
 * which is caught by the global error handler.
 * 
 * Note: This only verifies identity. It does not look up database roles or permissions.
 */
export const requireUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = extractBearerToken(req.headers.authorization);
    
    if (!token) {
      throw AuthError.unauthorized('Missing Bearer token in Authorization header.');
    }

    const { subject, email } = await verifyUserToken(token);

    // Populate the Express Request with the verified AuthContext
    req.auth = {
      subject,
      email,
      tokenType: 'user',
      // We set role to 'viewer' as a safe default. The role-resolution middleware 
      // (implemented in a later step) will overwrite this with the real database role.
      role: 'viewer',
      vehicleIds: [],
    };

    next();
  } catch (error) {
    next(error);
  }
};
