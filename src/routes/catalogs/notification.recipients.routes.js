import { Router } from 'express';
import * as ctrNotificationRecipients from '../../controllers/catalogs/notification.recipients.controller.js';

const router = Router();

router.get('/', ctrNotificationRecipients.getCatNotificationRecipients);

export default router;
