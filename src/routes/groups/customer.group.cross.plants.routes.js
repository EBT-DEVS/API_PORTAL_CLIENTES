import { Router } from 'express';
import * as ctrCustomerGroupCrossPlants from '../../controllers/groups/customer.group.cross.plants.controller.js';

const router = Router();

router.get('/', ctrCustomerGroupCrossPlants.getCustomerGroupCrossPlantsData);
router.post('/', ctrCustomerGroupCrossPlants.createCustomerGroupCrossPlant);
router.put('/:id', ctrCustomerGroupCrossPlants.editCustomerGroupCrossPlant);

export default router;
