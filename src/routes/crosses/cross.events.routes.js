import { Router } from 'express';
import * as ctrCrossEvents from '../../controllers/crosses/cross.events.controller.js';

const router = Router();

router.post('/', ctrCrossEvents.createCrossEvent);
router.put('/:id', ctrCrossEvents.updateCrossEventById);

export default router;
