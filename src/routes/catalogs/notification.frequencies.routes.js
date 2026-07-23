import { Router } from 'express';
import * as ctrNotificationFrequencies from '../../controllers/catalogs/notification.frequencies.controller.js';

const router = Router();

router.get('/', ctrNotificationFrequencies.getCatNotificationFrequencies);

export default router;
