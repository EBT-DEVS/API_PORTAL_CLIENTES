import { Router } from 'express';
import * as ctrCustomerGroupCrossPlantsExceptions from '../../controllers/customer_group_cross_plants_exceptions/customer.group.cross.plants.exceptions.controller.js';

const router = Router();

router.get('/', ctrCustomerGroupCrossPlantsExceptions.getCustomerGroupCrossPlantsExceptionsData);
router.post('/', ctrCustomerGroupCrossPlantsExceptions.createCustomerGroupCrossPlantException);
router.put('/:id', ctrCustomerGroupCrossPlantsExceptions.editCustomerGroupCrossPlantException);

export default router;
