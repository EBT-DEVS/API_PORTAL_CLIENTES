import { Router } from 'express';
import * as ctrCrossPriorities from '../../controllers/catalogs/cross.priorities.controller.js';

const router = Router();

router.get('/', ctrCrossPriorities.getCatCrossPriorities);

export default router;
