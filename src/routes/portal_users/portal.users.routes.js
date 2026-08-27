import { Router } from 'express';
import * as ctrPortalUsers from '../../controllers/portal_users/portal.users.controller.js';

const router = Router();

router.get('/', ctrPortalUsers.getPortalUsersList);
router.post('/', ctrPortalUsers.createPortalUser);
router.put('/:id', ctrPortalUsers.updatePortalUserById);

export default router;
