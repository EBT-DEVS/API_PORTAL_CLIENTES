import { Router } from 'express';

import notificationChannelsRoutes from './catalogs/notification.channels.routes.js';
import notificationFrequenciesRoutes from './catalogs/notification.frequencies.routes.js';
import notificationReasonsRoutes from './catalogs/notification.reasons.routes.js';
import notificationRecipientsRoutes from './catalogs/notification.recipients.routes.js';
import mcleodCustomersRoutes from './catalogs/mcleod.customers.routes.js';
import mcleodRouteLocationsRoutes from './catalogs/mcleod.route.locations.routes.js';
import crossEventsRoutes from './catalogs/cross.events.routes.js';
import crossPrioritiesRoutes from './catalogs/cross.priorities.routes.js';
import crossStatusesRoutes from './catalogs/cross.statuses.routes.js';
import crossesRoutes from './crosses/crosses.routes.js';
import crossOrderEventsRoutes from './crosses/cross.events.routes.js';
import customerGroupsRoutes from './groups/customer.groups.routes.js';
import customerGroupCustomersRoutes from './groups/customer.group.customers.routes.js';
import customerGroupCrossPlantsRoutes from './groups/customer.group.cross.plants.routes.js';
import customerGroupCrossPlantExceptionsRoutes from './customer_group_cross_plants_exceptions/customer.group.cross.plants.exceptions.routes.js';
import loginRoutes from './login/login.routes.js';
import notificationSubscriptionsRoutes from './notifications/notification.subscriptions.routes.js';
import portalUsersRoutes from './portal_users/portal.users.routes.js';
import systemRoutes from './system/system.routes.js';

const router = Router();

router.use('/login', loginRoutes);
router.use('/crosses', crossesRoutes);
router.use('/cross-events', crossOrderEventsRoutes);
router.use('/customer-groups', customerGroupsRoutes);
router.use('/customer-group-customers', customerGroupCustomersRoutes);
router.use('/customer-group-cross-plants', customerGroupCrossPlantsRoutes);
router.use('/customer-group-cross-plant-exceptions', customerGroupCrossPlantExceptionsRoutes);
router.use('/catalogs/cross-events', crossEventsRoutes);
router.use('/catalogs/cross-priorities', crossPrioritiesRoutes);
router.use('/catalogs/cross-statuses', crossStatusesRoutes);
router.use('/catalogs/mcleod-customers', mcleodCustomersRoutes);
router.use('/catalogs/mcleod-route-locations', mcleodRouteLocationsRoutes);
router.use('/catalogs/notification-channels', notificationChannelsRoutes);
router.use('/catalogs/notification-frequencies', notificationFrequenciesRoutes);
router.use('/catalogs/notification-reasons', notificationReasonsRoutes);
router.use('/catalogs/notification-recipients', notificationRecipientsRoutes);
router.use('/notifications', notificationSubscriptionsRoutes);
router.use('/portal-users', portalUsersRoutes);
router.use('/system', systemRoutes);

export default router;
