import express from 'express';
import cors from 'cors';

import eventRoutes from './routes/event.routes.js';
import registrationRoutes from './routes/registration.routes.js';
import installmentRoutes from './routes/installment.routes.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';

const app = express();

/* ── Middlewares globales ───────────────────────────────────────────── */
app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*',
}));
app.use(express.json());

/* ── Rutas de la API ────────────────────────────────────────────────── */
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/api/events', eventRoutes);
app.use('/api/registrations', registrationRoutes);
app.use('/api/installments', installmentRoutes);

/* ── Manejo de rutas inexistentes y errores ─────────────────────────── */
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
