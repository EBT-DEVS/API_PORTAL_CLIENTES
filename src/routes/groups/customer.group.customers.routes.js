import { Router } from 'express';
import * as ctrCustomerGroupCustomers from '../../controllers/groups/customer.group.customers.controller.js';

const router = Router();

router.get('/', ctrCustomerGroupCustomers.getCustomerGroupCustomersData);
router.post('/', ctrCustomerGroupCustomers.createCustomerGroupCustomer);
router.put('/:id', ctrCustomerGroupCustomers.editCustomerGroupCustomer);

export default router;
