import { Router } from 'express';
import * as ctrCustomerGroups from '../../controllers/groups/customer.groups.controller.js';

const router = Router();

router.get('/', ctrCustomerGroups.getCustomerGroupsData);

export default router;
