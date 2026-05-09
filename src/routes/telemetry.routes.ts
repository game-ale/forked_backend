import { Router } from 'express';
import { requireDevice } from '../middleware/require-device';
import { ingestTelemetry } from '../controllers/telemetry.controller';

const router = Router();

// POST /api/telemetry
// Protected strictly by the IoT hardware device token
router.post('/', requireDevice, ingestTelemetry);

export default router;
