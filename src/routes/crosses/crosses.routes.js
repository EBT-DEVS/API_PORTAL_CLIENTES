import { Router } from 'express';
import * as ctrCrosses from '../../controllers/crosses/crosses.controller.js';

const router = Router();

router.get('/active/trailers', ctrCrosses.getActiveCrosses);
router.put('/stops/:crossStopId/customs', ctrCrosses.saveCrossCustoms);
router.get('/:crossId', ctrCrosses.getCrossDetail);

export default router;

