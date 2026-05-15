import { Request, Response, NextFunction } from 'express';
import { telemetryPayloadSchema } from '../schemas/telemetry.schema';
import { prisma } from '../lib/prisma';
import { AuthError } from '../auth/errors';

export const ingestTelemetry = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 1. Validate payload against Zod schema
    const validationResult = telemetryPayloadSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Validation Error',
        details: validationResult.error.issues,
      });
    }

    const payload = validationResult.data;

    if (!req.auth || req.auth.subject !== payload.deviceId) {
      throw AuthError.forbidden(`Spoofing detected: Authenticated device ${req.auth?.subject} cannot submit telemetry for device ${payload.deviceId}`);
    }

    if (!req.auth.vehicleIds.includes(payload.vehicleId)) {
      throw AuthError.forbidden(
        `Spoofing detected: Authenticated device ${req.auth.subject} is not assigned to vehicle ${payload.vehicleId}`,
      );
    }

    if (!prisma) {
      throw new Error('Database is not configured. Cannot process telemetry.');
    }

    const vehicle = await prisma.vehicle.findUnique({
      where: { vehicleId: payload.vehicleId },
      select: { vehicleId: true },
    });

    if (!vehicle) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Vehicle with ID ${payload.vehicleId} does not exist or is not registered.`,
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.telemetryRaw.create({
        data: {
          payload: req.body,
          source: payload.source,
        },
      });

      await tx.telemetryNormalized.create({
        data: {
          vehicleId: payload.vehicleId,
          deviceId: payload.deviceId,
          timestamp: new Date(payload.timestamp),
          fuelLevelLiters: payload.fuelLevelLiters ?? null,
          fuelLevelPercent: payload.fuelLevelPercent ?? null,
          latitude: payload.latitude ?? null,
          longitude: payload.longitude ?? null,
          speedKph: payload.speedKph ?? null,
          engineStatus: payload.engineStatus ?? null,
        },
      });

      await tx.vehicleLatestState.upsert({
        where: { vehicleId: payload.vehicleId },
        create: {
          vehicleId: payload.vehicleId,
          lastSeenAt: new Date(payload.timestamp),
          fuelLevelLiters: payload.fuelLevelLiters ?? null,
          fuelLevelPercent: payload.fuelLevelPercent ?? null,
          latitude: payload.latitude ?? null,
          longitude: payload.longitude ?? null,
          engineStatus: payload.engineStatus ?? null,
          deviceStatus: 'online',
        },
        update: {
          lastSeenAt: new Date(payload.timestamp),
          fuelLevelLiters: payload.fuelLevelLiters ?? undefined,
          fuelLevelPercent: payload.fuelLevelPercent ?? undefined,
          latitude: payload.latitude ?? undefined,
          longitude: payload.longitude ?? undefined,
          engineStatus: payload.engineStatus ?? undefined,
          deviceStatus: 'online',
        },
      });
    });

    res.status(202).json({
      message: 'Telemetry ingested successfully',
      deviceId: payload.deviceId,
      vehicleId: payload.vehicleId,
    });
  } catch (error) {
    next(error);
  }
};
