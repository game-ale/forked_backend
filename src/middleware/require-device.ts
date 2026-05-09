import { Request, Response, NextFunction } from 'express';
import { extractBearerToken } from '../auth/jwt';
import { AuthError } from '../auth/errors';
import { DEVICE_TOKEN_PREFIX, hashDeviceToken } from '../auth/device-tokens';
import { prisma } from '../lib/prisma';

/**
 * Express middleware that verifies the request contains a valid hardware Device Token.
 * If valid, it populates `req.auth` with the deviceId as the subject, and assigns
 * the 'viewer' role by default.
 * If invalid, missing, or suspended, it throws an AuthError (401 Unauthorized or 403 Forbidden).
 */
export const requireDevice = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawToken = extractBearerToken(req.headers.authorization);

    // 1. Ensure token exists
    if (!rawToken) {
      throw AuthError.unauthorized('Missing Bearer token in Authorization header.');
    }

    // 2. Validate token format: fd_device_<deviceId>_<secret>
    if (!rawToken.startsWith(DEVICE_TOKEN_PREFIX)) {
      throw AuthError.unauthorized('Invalid device token format.');
    }

    const parts = rawToken.split('_');
    // Expected format splits into: ['fd', 'device', '<deviceId>', '<secret>']
    if (parts.length < 4) {
      throw AuthError.unauthorized('Malformed device token.');
    }

    // 3. Extract the device ID for a fast O(1) database lookup
    const deviceId = parts[2];

    // 4. Query the database
    if (!prisma) {
      throw new Error('Database is not configured. Cannot resolve device credential.');
    }
    const credential = await prisma.deviceCredential.findUnique({
      where: { deviceId },
    });

    if (!credential) {
      throw AuthError.unauthorized('Device credential not found.');
    }

    // 5. Cryptographically verify the hash
    const computedHash = hashDeviceToken(rawToken);
    if (credential.tokenHash !== computedHash) {
      throw AuthError.unauthorized('Invalid device token.');
    }

    // 6. Check for active status
    if (credential.status !== 'active') {
      throw AuthError.forbidden('Access denied. Device credential is suspended.');
    }

    // 7. Populate the AuthContext
    req.auth = {
      subject: deviceId,
      email: null,
      tokenType: 'device',
      role: 'viewer', // Hardware devices are mapped to viewers 
      profileResolved: true, // Mark as resolved so requireRole can be used if needed
      vehicleIds: [], // Future step will populate this
    };

    next();
  } catch (error) {
    next(error);
  }
};
