import { NextFunction, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthError } from '../auth/errors';

export const listVehicles = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth || !req.auth.profileResolved) {
      throw AuthError.unauthorized('Authentication context is missing. Ensure resolveUserProfile runs first.');
    }

    if (!prisma) {
      throw new Error('Database is not configured.');
    }

    const where =
      req.auth.role === 'admin'
        ? undefined
        : {
            vehicleId: {
              in: req.auth.vehicleIds,
            },
          };

    const vehicles = await prisma.vehicle.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        vehicleId: true,
        plateNumber: true,
        label: true,
        tankCapacityLiters: true,
        status: true,
        createdAt: true,
      },
    });

    res.status(200).json({
      message: 'Vehicles retrieved successfully',
      data: vehicles,
    });
  } catch (error) {
    next(error);
  }
};

export const getVehicleLatestState = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawVehicleId = req.params.vehicleId;
    const vehicleId = Array.isArray(rawVehicleId) ? rawVehicleId[0] : rawVehicleId;

    if (typeof vehicleId !== 'string' || vehicleId.length === 0) {
      throw AuthError.forbidden('Access denied. Missing vehicle route param: vehicleId');
    }

    if (!prisma) {
      throw new Error('Database is not configured.');
    }

    const latestState = await prisma.vehicleLatestState.findUnique({
      where: { vehicleId },
      select: {
        vehicleId: true,
        lastSeenAt: true,
        fuelLevelLiters: true,
        fuelLevelPercent: true,
        latitude: true,
        longitude: true,
        engineStatus: true,
        deviceStatus: true,
        currentAlertLevel: true,
      },
    });

    if (!latestState) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Latest state for vehicle ${vehicleId} was not found.`,
      });
    }

    res.status(200).json({
      message: 'Vehicle latest state retrieved successfully',
      data: latestState,
    });
  } catch (error) {
    next(error);
  }
};
