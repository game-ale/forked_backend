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

    if (!rawToken) {
      throw AuthError.unauthorized('Missing Bearer token in Authorization header.');
    }

    if (!rawToken.startsWith(DEVICE_TOKEN_PREFIX)) {
      throw AuthError.unauthorized('Invalid device token format.');
    }

    const parts = rawToken.split('_');
    if (parts.length < 4) {
      throw AuthError.unauthorized('Malformed device token.');
    }

    const deviceId = parts[2];

    if (!prisma) {
      throw new Error('Database is not configured. Cannot resolve device credential.');
    }
    const credential = await prisma.deviceCredential.findUnique({
      where: { deviceId },
    });

    if (!credential) {
      throw AuthError.unauthorized('Device credential not found.');
    }

    const computedHash = hashDeviceToken(rawToken);
    if (credential.tokenHash !== computedHash) {
      throw AuthError.unauthorized('Invalid device token.');
    }

    if (credential.status !== 'active') {
      throw AuthError.forbidden('Access denied. Device credential is disabled.');
    }

    const credentialVehicleId = (credential as { vehicleId?: string }).vehicleId;
    if (!credentialVehicleId) {
      throw new Error('Device credential is missing its vehicle binding.');
    }

    req.auth = {
      subject: deviceId,
      email: null,
      tokenType: 'device',
      role: 'viewer',
      profileResolved: true,
      vehicleIds: [credentialVehicleId],
    };

    next();
  } catch (error) {
    next(error);
  }
};
