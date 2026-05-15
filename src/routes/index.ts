import { Router } from 'express';
import telemetryRoutes from './telemetry.routes';
import adminRoutes from './admin.routes';
import vehicleRoutes from './vehicle.routes';

export const apiRouter = Router();

apiRouter.use('/telemetry', telemetryRoutes);
apiRouter.use('/admin', adminRoutes);
apiRouter.use('/vehicles', vehicleRoutes);
