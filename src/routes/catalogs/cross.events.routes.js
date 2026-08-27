import { Router } from 'express';
import * as ctrCrossEvents from '../../controllers/catalogs/cross.events.controller.js';

const router = Router();

router.get('/', ctrCrossEvents.getCatCrossEvents);
router.post('/', ctrCrossEvents.createCatCrossEvent);
router.put('/:id', ctrCrossEvents.updateCatCrossEventById);

export default router;
