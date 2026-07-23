import { Router } from 'express';
import * as ctrNotificationSubscriptions from '../../controllers/notifications/notification.subscriptions.controller.js';

const router = Router();

router.post('/subscriptions', ctrNotificationSubscriptions.createNotificationSubscriptionFlow);

export default router;
