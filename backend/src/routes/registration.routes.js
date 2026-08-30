import { Router } from 'express';

import { getRegistrationStatus } from '../controllers/registration.controller.js';

const router = Router();

/* GET /api/registrations/:id/status -> detalle + historial de cuotas */
router.get('/:id/status', getRegistrationStatus);

export default router;
