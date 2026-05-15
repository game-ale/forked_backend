import { Router } from 'express';
import { requireUser } from '../middleware/require-user';
import { resolveUserProfile } from '../middleware/resolve-profile';
import { requireRole } from '../middleware/require-role';
import { getUsers } from '../controllers/admin.controller';

const router = Router();

// Apply security middlewares globally to the entire admin router
router.use(requireUser);
router.use(resolveUserProfile);
router.use(requireRole('admin'));

// GET /api/admin/users
router.get('/users', getUsers);

export default router;
