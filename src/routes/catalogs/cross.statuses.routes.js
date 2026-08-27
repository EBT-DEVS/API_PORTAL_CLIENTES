import { Router } from 'express';
import * as ctrCrossStatuses from '../../controllers/catalogs/cross.statuses.controller.js';

const router = Router();

router.get('/', ctrCrossStatuses.getCatCrossStatuses);

export default router;
