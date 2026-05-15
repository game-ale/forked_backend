import { z } from 'zod';

export const createDeviceCredentialSchema = z.object({
  deviceId: z.string().min(1),
  vehicleId: z.string().uuid(),
});

export type CreateDeviceCredentialInput = z.infer<typeof createDeviceCredentialSchema>;
