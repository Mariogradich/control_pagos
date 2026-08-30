import { Router } from 'express';

import { payInstallment } from '../controllers/installment.controller.js';

const router = Router();

/* POST /api/installments/:id/pay -> registra abono (parcial o total) */
router.post('/:id/pay', payInstallment);

export default router;
