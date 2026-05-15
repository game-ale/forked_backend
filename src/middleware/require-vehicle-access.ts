import { Request, Response, NextFunction } from 'express';
import { AuthError } from '../auth/errors';

export const requireVehicleAccess = (paramName: string) => {
  if (!paramName) {
    throw new Error('requireVehicleAccess must be called with a route param name.');
  }

  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.auth || !req.auth.profileResolved) {
        throw AuthError.unauthorized('Authentication context is missing. Ensure resolveUserProfile runs first.');
      }

      const rawVehicleId = req.params[paramName];
      const vehicleId = Array.isArray(rawVehicleId) ? rawVehicleId[0] : rawVehicleId;
      if (typeof vehicleId !== 'string' || vehicleId.length === 0) {
        throw AuthError.forbidden(`Access denied. Missing vehicle route param: ${paramName}`);
      }

      if (req.auth.role !== 'admin' && !req.auth.vehicleIds.includes(vehicleId)) {
        throw AuthError.forbidden('Access denied. You do not have access to this vehicle.');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
