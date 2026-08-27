import { Router } from 'express';
import * as ctrMcleodRouteLocations from '../../controllers/catalogs/mcleod.route.locations.controller.js';

const router = Router();

router.get('/', ctrMcleodRouteLocations.getCatMcleodRouteLocations);

export default router;
