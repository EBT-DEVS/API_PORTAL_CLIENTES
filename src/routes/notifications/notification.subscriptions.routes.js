import { Router } from 'express';
import * as ctrNotificationDispatchLogs from '../../controllers/notifications/notification.dispatch.logs.controller.js';
import * as ctrNotificationReasonRecipients from '../../controllers/notifications/notification.reason.recipients.controller.js';
import * as ctrNotificationSubscriptions from '../../controllers/notifications/notification.subscriptions.controller.js';

const router = Router();

router.get('/dispatch-logs', ctrNotificationDispatchLogs.getNotificationDispatchLogsConfig);
router.get('/reason-recipients', ctrNotificationReasonRecipients.getNotificationReasonRecipientsConfig);
router.post('/reason-recipients', ctrNotificationReasonRecipients.createNotificationReasonRecipientConfig);
router.put('/reason-recipients/:id', ctrNotificationReasonRecipients.updateNotificationReasonRecipientConfig);
router.put('/reason-recipients/:id/deactivate', ctrNotificationReasonRecipients.deactivateNotificationReasonRecipientConfig);
router.get('/subscriptions', ctrNotificationSubscriptions.getNotificationSubscriptionsConfig);
router.post('/subscriptions', ctrNotificationSubscriptions.createNotificationSubscriptionFlow);
router.put('/subscriptions/:id/deactivate', ctrNotificationSubscriptions.deactivateNotificationSubscriptionConfig);

export default router;
