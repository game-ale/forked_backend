import { Router } from 'express';
import { requireUser } from '../middleware/require-user';
import { resolveUserProfile } from '../middleware/resolve-profile';
import { requireRole } from '../middleware/require-role';
import {
  createDeviceCredential,
  disableDeviceCredential,
  getUsers,
  assignDriverVehicle,
  replaceViewerVehicleAccess,
  rotateDeviceCredential,
  updateUserRole,
  updateUserStatus,
} from '../controllers/admin.controller';

const router = Router();

// Apply security middlewares globally to the entire admin router
router.use(requireUser);
router.use(resolveUserProfile);
router.use(requireRole('admin'));

// GET /api/admin/users
router.get('/users', getUsers);
router.patch('/users/:userId/role', updateUserRole);
router.patch('/users/:userId/status', updateUserStatus);
router.put('/users/:userId/viewer-access', replaceViewerVehicleAccess);
router.put('/users/:userId/driver-assignment', assignDriverVehicle);
router.post('/devices', createDeviceCredential);
router.post('/devices/:deviceId/rotate', rotateDeviceCredential);
router.patch('/devices/:deviceId/disable', disableDeviceCredential);

export default router;
