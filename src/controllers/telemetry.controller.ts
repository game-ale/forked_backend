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

    // 2. Security Check: Prevent device spoofing
    // The authenticated deviceId (from req.auth.subject) must match the payload's deviceId
    if (!req.auth || req.auth.subject !== payload.deviceId) {
      throw AuthError.forbidden(`Spoofing detected: Authenticated device ${req.auth?.subject} cannot submit telemetry for device ${payload.deviceId}`);
    }

    // Ensure database is configured
    if (!prisma) {
      throw new Error('Database is not configured. Cannot process telemetry.');
    }

    // 3. Verify that the vehicle exists
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

    // 4. Persist data across all 3 tables inside a single Prisma Transaction
    await prisma.$transaction(async (tx) => {
      // A. Write to TelemetryRaw
      await tx.telemetryRaw.create({
        data: {
          payload: req.body, // Store exactly what the client sent
          source: payload.source,
        },
      });

      // B. Write to TelemetryNormalized
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

      // C. Upsert into VehicleLatestState for fast UI reads
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
          deviceStatus: 'online', // Implicitly online since we just got telemetry
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

    // 5. Return success
    res.status(202).json({
      message: 'Telemetry ingested successfully',
      deviceId: payload.deviceId,
      vehicleId: payload.vehicleId,
    });
  } catch (error) {
    next(error);
  }
};
