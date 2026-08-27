import { Router } from 'express';
import * as ctrNotificationReasons from '../../controllers/catalogs/notification.reasons.controller.js';

const router = Router();

router.get('/', ctrNotificationReasons.getCatNotificationReasons);

export default router;
