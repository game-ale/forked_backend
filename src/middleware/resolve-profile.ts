import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AuthError } from '../auth/errors';
import { AppRole } from '../auth/types';

/**
 * Express middleware that resolves the authenticated user's database profile.
 * MUST be placed after `requireUser` in the middleware chain.
 * 
 * - Rejects requests if no `user_profiles` record exists.
 * - Rejects requests if the user's status is not 'active'.
 * - Upgrades `req.auth.role` to their actual database role.
 */
export const resolveUserProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 1. Ensure `requireUser` ran successfully first
    if (!req.auth || !req.auth.subject) {
      throw AuthError.unauthorized('Authentication context is missing. Ensure requireUser runs first.');
    }

    // 2. Query the database directly for fresh security guarantees
    if (!prisma) {
      throw new Error('Database is not configured. Cannot resolve user profile.');
    }
    const profile = await prisma.userProfile.findUnique({
      where: { id: req.auth.subject },
    });

    // 3. Handle missing profiles (They are authenticated in Supabase, but missing in our DB)
    if (!profile) {
      throw AuthError.forbidden('Access denied. No user profile found.');
    }

    // 4. Handle disabled accounts
    if (profile.status !== 'active') {
      throw AuthError.forbidden('Access denied. User account is disabled.');
    }

    // 5. Upgrade the request context
    req.auth.role = profile.role as AppRole;
    
    // We also overwrite the email if the database has it mapped differently
    if (profile.email) {
      req.auth.email = profile.email;
    }

    next();
  } catch (error) {
    next(error);
  }
};
