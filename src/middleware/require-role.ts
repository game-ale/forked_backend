import { Request, Response, NextFunction } from 'express';
import { AppRole } from '../auth/types';
import { AuthError } from '../auth/errors';

/**
 * Express middleware factory that restricts access to specific roles.
 * MUST be placed after `resolveUserProfile` in the middleware chain.
 * 
 * @param allowedRoles The array of AppRoles allowed to access the route.
 */
export const requireRole = (...allowedRoles: AppRole[]) => {
  if (allowedRoles.length === 0) {
    throw new Error('requireRole must be called with at least one allowed role.');
  }

  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // 1. Ensure `resolveUserProfile` ran successfully first
      if (!req.auth || !req.auth.profileResolved) {
        throw AuthError.unauthorized('Authentication context is missing. Ensure resolveUserProfile runs first.');
      }

      // 2. Check if the user's role is in the allowed list
      if (!allowedRoles.includes(req.auth.role)) {
        throw AuthError.forbidden(`Access denied. Requires one of the following roles: ${allowedRoles.join(', ')}`);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
