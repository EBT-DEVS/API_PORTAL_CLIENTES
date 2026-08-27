import { Router } from 'express';
import * as ctrMcleodCustomers from '../../controllers/catalogs/mcleod.customers.controller.js';

const router = Router();

router.get('/', ctrMcleodCustomers.getCatMcleodCustomers);

export default router;
