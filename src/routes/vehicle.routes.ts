import { Router } from 'express';
import { listVehicles, getVehicleLatestState } from '../controllers/vehicle.controller';
import { requireUser } from '../middleware/require-user';
import { resolveUserProfile } from '../middleware/resolve-profile';
import { requireVehicleAccess } from '../middleware/require-vehicle-access';

const router = Router();

router.use(requireUser);
router.use(resolveUserProfile);

router.get('/', listVehicles);
router.get('/:vehicleId/latest', requireVehicleAccess('vehicleId'), getVehicleLatestState);

export default router;
