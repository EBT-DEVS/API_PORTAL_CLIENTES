import { Router } from 'express';

import notificationChannelsRoutes from './catalogs/notification.channels.routes.js';
import notificationFrequenciesRoutes from './catalogs/notification.frequencies.routes.js';
import notificationRecipientsRoutes from './catalogs/notification.recipients.routes.js';
import crossPrioritiesRoutes from './catalogs/cross.priorities.routes.js';
import crossesRoutes from './crosses/crosses.routes.js';
import customerGroupsRoutes from './groups/customer.groups.routes.js';
import loginRoutes from './login/login.routes.js';
import notificationSubscriptionsRoutes from './notifications/notification.subscriptions.routes.js';

const router = Router();

router.use('/login', loginRoutes);
router.use('/crosses', crossesRoutes);
router.use('/customer-groups', customerGroupsRoutes);
router.use('/catalogs/cross-priorities', crossPrioritiesRoutes);
router.use('/catalogs/notification-channels', notificationChannelsRoutes);
router.use('/catalogs/notification-frequencies', notificationFrequenciesRoutes);
router.use('/catalogs/notification-recipients', notificationRecipientsRoutes);
router.use('/notifications', notificationSubscriptionsRoutes);

export default router;
