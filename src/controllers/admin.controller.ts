import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { generateDeviceToken } from '../auth/device-tokens';
import { AuthError } from '../auth/errors';
import { createDeviceCredentialSchema } from '../schemas/device-credential.schema';
import {
  assignDriverVehicleSchema,
  replaceViewerAccessSchema,
  updateUserRoleSchema,
  updateUserStatusSchema,
} from '../schemas/admin-user.schema';

/**
 * Retrieves a list of all registered users in the system.
 * Only accessible by administrators.
 */
export const getUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!prisma) {
      throw new Error('Database is not configured.');
    }

    // Fetch all user profiles from the database, ordering by creation date
    const users = await prisma.userProfile.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    res.status(200).json({
      message: 'Users retrieved successfully',
      data: users,
    });
  } catch (error) {
    next(error);
  }
};

export const createDeviceCredential = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = createDeviceCredentialSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation Error',
        details: parsed.error.issues,
      });
    }

    if (!prisma) {
      throw new Error('Database is not configured.');
    }

    const { deviceId, vehicleId } = parsed.data;
    const { token, hash } = generateDeviceToken(deviceId);

    const createdCredential = await (prisma.deviceCredential as any).create({
      data: {
        deviceId,
        vehicleId,
        tokenHash: hash,
        status: 'active',
      },
    });

    res.status(201).json({
      message: 'Device credential created successfully',
      data: {
        deviceId: createdCredential.deviceId,
        vehicleId,
        status: createdCredential.status,
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const rotateDeviceCredential = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawDeviceId = req.params.deviceId;
    const deviceId = Array.isArray(rawDeviceId) ? rawDeviceId[0] : rawDeviceId;

    if (typeof deviceId !== 'string' || deviceId.length === 0) {
      throw AuthError.forbidden('Access denied. Missing device route param: deviceId');
    }

    if (!prisma) {
      throw new Error('Database is not configured.');
    }

    const existingCredential = await (prisma.deviceCredential as any).findUnique({
      where: { deviceId },
    });

    if (!existingCredential) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Device credential ${deviceId} was not found.`,
      });
    }

    const { token, hash } = generateDeviceToken(deviceId);

    const updatedCredential = await (prisma.deviceCredential as any).update({
      where: { deviceId },
      data: {
        tokenHash: hash,
        status: 'active',
        lastRotatedAt: new Date(),
      },
    });

    res.status(200).json({
      message: 'Device credential rotated successfully',
      data: {
        deviceId: updatedCredential.deviceId,
        vehicleId: existingCredential.vehicleId,
        status: updatedCredential.status,
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const disableDeviceCredential = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawDeviceId = req.params.deviceId;
    const deviceId = Array.isArray(rawDeviceId) ? rawDeviceId[0] : rawDeviceId;

    if (typeof deviceId !== 'string' || deviceId.length === 0) {
      throw AuthError.forbidden('Access denied. Missing device route param: deviceId');
    }

    if (!prisma) {
      throw new Error('Database is not configured.');
    }

    const existingCredential = await (prisma.deviceCredential as any).findUnique({
      where: { deviceId },
    });

    if (!existingCredential) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Device credential ${deviceId} was not found.`,
      });
    }

    const disabledCredential = await (prisma.deviceCredential as any).update({
      where: { deviceId },
      data: {
        status: 'disabled',
      },
    });

    res.status(200).json({
      message: 'Device credential disabled successfully',
      data: {
        deviceId: disabledCredential.deviceId,
        vehicleId: existingCredential.vehicleId,
        status: disabledCredential.status,
      },
    });
  } catch (error) {
    next(error);
  }
};

function normalizeRouteParam(value: string | string[] | undefined, paramName: string) {
  const normalized = Array.isArray(value) ? value[0] : value;
  if (typeof normalized !== 'string' || normalized.length === 0) {
    throw AuthError.forbidden(`Access denied. Missing ${paramName} route param: ${paramName}`);
  }
  return normalized;
}

export const updateUserRole = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = normalizeRouteParam(req.params.userId, 'userId');
    const parsed = updateUserRoleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation Error',
        details: parsed.error.issues,
      });
    }

    if (!prisma) {
      throw new Error('Database is not configured.');
    }

    const updatedUser = await prisma.userProfile.update({
      where: { id: userId },
      data: {
        role: parsed.data.role,
      },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
      },
    });

    res.status(200).json({
      message: 'User role updated successfully',
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

export const updateUserStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = normalizeRouteParam(req.params.userId, 'userId');
    const parsed = updateUserStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation Error',
        details: parsed.error.issues,
      });
    }

    if (!prisma) {
      throw new Error('Database is not configured.');
    }

    const updatedUser = await prisma.userProfile.update({
      where: { id: userId },
      data: {
        status: parsed.data.status,
      },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
      },
    });

    res.status(200).json({
      message: 'User status updated successfully',
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

export const replaceViewerVehicleAccess = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = normalizeRouteParam(req.params.userId, 'userId');
    const parsed = replaceViewerAccessSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation Error',
        details: parsed.error.issues,
      });
    }

    if (!prisma) {
      throw new Error('Database is not configured.');
    }

    await prisma.$transaction(async (tx) => {
      await (tx.userVehicleAccess as any).deleteMany({
        where: {
          userId,
          accessLevel: 'viewer',
        },
      });

      if (parsed.data.vehicleIds.length > 0) {
        await (tx.userVehicleAccess as any).createMany({
          data: parsed.data.vehicleIds.map((vehicleId) => ({
            userId,
            vehicleId,
            accessLevel: 'viewer',
          })),
        });
      }
    });

    res.status(200).json({
      message: 'Viewer vehicle access updated successfully',
      data: {
        userId,
        vehicleIds: parsed.data.vehicleIds,
        accessLevel: 'viewer',
      },
    });
  } catch (error) {
    next(error);
  }
};

export const assignDriverVehicle = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = normalizeRouteParam(req.params.userId, 'userId');
    const parsed = assignDriverVehicleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation Error',
        details: parsed.error.issues,
      });
    }

    if (!prisma) {
      throw new Error('Database is not configured.');
    }

    await prisma.$transaction(async (tx) => {
      await (tx.userVehicleAccess as any).deleteMany({
        where: {
          userId,
          accessLevel: 'assigned_driver',
        },
      });

      await (tx.userVehicleAccess as any).create({
        data: {
          userId,
          vehicleId: parsed.data.vehicleId,
          accessLevel: 'assigned_driver',
        },
      });
    });

    res.status(200).json({
      message: 'Driver vehicle assignment updated successfully',
      data: {
        userId,
        vehicleId: parsed.data.vehicleId,
        accessLevel: 'assigned_driver',
      },
    });
  } catch (error) {
    next(error);
  }
};
