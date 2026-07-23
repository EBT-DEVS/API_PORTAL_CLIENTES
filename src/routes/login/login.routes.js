import { Router } from 'express';
import * as ctrLogin from '../../controllers/login/login.controller.js';

const router = Router();

router.post('/', ctrLogin.authenticateUser);
router.post('/clientes', ctrLogin.authenticatePortalClient);

export default router;
