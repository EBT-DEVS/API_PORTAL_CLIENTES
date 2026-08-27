import { Router } from 'express';
import * as ctrCustomerGroups from '../../controllers/groups/customer.groups.controller.js';

const router = Router();

router.get('/', ctrCustomerGroups.getCustomerGroupsData);
router.post('/', ctrCustomerGroups.createCustomerGroup);
router.put('/:id', ctrCustomerGroups.editCustomerGroup);

export default router;
