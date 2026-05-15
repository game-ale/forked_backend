import { z } from 'zod';

export const updateUserRoleSchema = z.object({
  role: z.enum(['admin', 'viewer', 'driver']),
});

export const updateUserStatusSchema = z.object({
  status: z.enum(['active', 'disabled']),
});

export const replaceViewerAccessSchema = z.object({
  vehicleIds: z.array(z.string().uuid()),
});

export const assignDriverVehicleSchema = z.object({
  vehicleId: z.string().uuid(),
});
