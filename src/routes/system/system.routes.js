import { Router } from 'express';
import * as ctrSystem from '../../controllers/system/system.controller.js';

const router = Router();

router.get('/data-last-updated', ctrSystem.getDataLastUpdated);

export default router;
