import { z } from 'zod';

export const telemetryPayloadSchema = z.object({
  schemaVersion: z.string(),
  deviceId: z.string(),
  vehicleId: z.string().uuid(),
  timestamp: z.string().datetime(),
  fuelLevelLiters: z.number().optional().nullable(),
  fuelLevelPercent: z.number().min(0).max(100).optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  speedKph: z.number().optional().nullable(),
  engineStatus: z.string().optional().nullable(),
  source: z.string().default('hardware'),
});

export type TelemetryPayload = z.infer<typeof telemetryPayloadSchema>;
