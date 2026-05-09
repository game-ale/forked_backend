import { Router } from 'express';
import telemetryRoutes from './telemetry.routes';

export const apiRouter = Router();

apiRouter.use('/telemetry', telemetryRoutes);
