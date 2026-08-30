import { Router } from 'express';

import {
  listEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  registerAttendee,
  getEventDashboard,
  searchRegistrations,
} from '../controllers/event.controller.js';

const router = Router();

/* GET /api/events                          -> lista de eventos            */
router.get('/', listEvents);

/* POST /api/events                         -> crear evento                */
router.post('/', createEvent);

/* PUT /api/events/:eventId                 -> editar evento               */
router.put('/:eventId', updateEvent);

/* DELETE /api/events/:eventId              -> eliminar evento             */
router.delete('/:eventId', deleteEvent);

/* POST /api/events/register                -> inscripcion + plan de cuotas */
router.post('/register', registerAttendee);

/* GET /api/events/:eventId/dashboard       -> metricas del evento          */
router.get('/:eventId/dashboard', getEventDashboard);

/* GET /api/events/:eventId/registrations   -> buscar asistentes (?search=) */
router.get('/:eventId/registrations', searchRegistrations);

export default router;
