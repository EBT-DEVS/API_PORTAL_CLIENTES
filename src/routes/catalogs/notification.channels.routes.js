import { Router } from 'express';
import * as ctrNotificationChannels from '../../controllers/catalogs/notification.channels.controller.js';

const router = Router();

router.get('/', ctrNotificationChannels.getCatNotificationChannels);

export default router;
