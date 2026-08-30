import { pool, withTransaction } from '../config/db.js';
import { HttpError, asyncHandler } from '../utils/httpError.js';
import { splitEquitatively } from '../utils/money.js';
import { addMonths, diffWholeMonths, toDateOnly } from '../utils/dates.js';

/* ══════════════════════════ CONSULTAS DE EVENTOS ═════════════════════ */

/**
 * GET /api/events
 * Lista de eventos para los selectores del frontend.
 */
export const listEvents = asyncHandler(async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT e.id,
            e.title,
            e.event_date AS "date",
            e.base_price AS "basePrice",
            COUNT(DISTINCT r.id)::int                        AS "registrationsCount",
            COALESCE(SUM(i.paid_amount), 0)                 AS "collected"
     FROM events e
     LEFT JOIN registrations r ON r.event_id = e.id
     LEFT JOIN installments i ON i.registration_id = r.id
     GROUP BY e.id
     ORDER BY e.event_date ASC`,
  );
  res.json(
    rows.map(({ basePrice, collected, ...rest }) => ({
      ...rest,
      basePrice: Number(basePrice),
      collected: Number(collected),
    })),
  );
});

/* ═════════════════════════════ CRUD DE EVENTOS ══════════════════════ */

/** Valida el payload compartido de crear/editar evento. */
function validateEventPayload(body) {
  const title = String(body?.title ?? '').trim();
  if (!title) throw new HttpError(400, 'El campo title es obligatorio');
  if (title.length > 200) {
    throw new HttpError(400, 'El titulo no puede superar los 200 caracteres');
  }

  const eventDate = new Date(body?.event_date);
  if (Number.isNaN(eventDate.getTime())) {
    throw new HttpError(400, 'event_date no es una fecha valida');
  }

  const basePrice = Number(body?.base_price);
  if (!Number.isFinite(basePrice) || basePrice < 0) {
    throw new HttpError(400, 'base_price debe ser un monto mayor o igual a 0');
  }

  return { title, eventDate, basePrice };
}

const EVENT_RETURN = `
  RETURNING id, title, event_date AS "date", base_price AS "basePrice"`;

/**
 * POST /api/events
 * Crea un evento. Body: { title, event_date, base_price }
 */
export const createEvent = asyncHandler(async (req, res) => {
  const { title, eventDate, basePrice } = validateEventPayload(req.body);

  if (eventDate <= new Date()) {
    throw new HttpError(400, 'La fecha del evento debe estar en el futuro');
  }

  const { rows } = await pool.query(
    `INSERT INTO events (title, event_date, base_price)
     VALUES ($1, $2, $3)${EVENT_RETURN}`,
    [title, eventDate.toISOString(), basePrice],
  );

  res.status(201).json({ ...rows[0], basePrice: Number(rows[0].basePrice) });
});

/**
 * PUT /api/events/:eventId
 * Actualiza titulo, fecha y/o precio base de un evento.
 */
export const updateEvent = asyncHandler(async (req, res) => {
  const eventId = Number(req.params.eventId);
  if (!Number.isInteger(eventId)) throw new HttpError(400, 'eventId invalido');

  const { title, eventDate, basePrice } = validateEventPayload(req.body);

  const { rows } = await pool.query(
    `UPDATE events
        SET title = $1, event_date = $2, base_price = $3
      WHERE id = $4${EVENT_RETURN}`,
    [title, eventDate.toISOString(), basePrice, eventId],
  );
  if (rows.length === 0) throw new HttpError(404, 'Evento no encontrado');

  res.json({ ...rows[0], basePrice: Number(rows[0].basePrice) });
});

/**
 * DELETE /api/events/:eventId
 * Elimina un evento SIN inscripciones (borrado duro).
 * Con inscripciones registradas responde 409 para no borrar datos por descuido.
 */
export const deleteEvent = asyncHandler(async (req, res) => {
  const eventId = Number(req.params.eventId);
  if (!Number.isInteger(eventId)) throw new HttpError(400, 'eventId invalido');

  const exists = await pool.query('SELECT 1 FROM events WHERE id = $1', [eventId]);
  if (exists.rowCount === 0) throw new HttpError(404, 'Evento no encontrado');

  const reg = await pool.query(
    'SELECT 1 FROM registrations WHERE event_id = $1 LIMIT 1',
    [eventId],
  );
  if (reg.rowCount > 0) {
    throw new HttpError(
      409,
      'No se puede eliminar un evento que ya tiene inscripciones registradas',
    );
  }

  await pool.query('DELETE FROM events WHERE id = $1', [eventId]);
  res.status(204).end();
});

/**
 * GET /api/events/:eventId/registrations?search=texto
 * Busca asistentes de un evento por nombre o email (ILIKE, sin mayusculas).
 * Sin termino de busqueda devuelve todas las inscripciones del evento.
 */
export const searchRegistrations = asyncHandler(async (req, res) => {
  const eventId = Number(req.params.eventId);
  if (!Number.isInteger(eventId)) throw new HttpError(400, 'eventId invalido');

  // El patron '%%' tambien coincide con todo -> un solo query para ambos casos
  const pattern = `%${String(req.query.search ?? '').trim()}%`;

  const { rows } = await pool.query(
    `SELECT r.id,
            r.name,
            r.email,
            r.phone,
            r.total_agreed        AS "totalAgreed",
            r.registration_status AS "registrationStatus",
            COALESCE(SUM(i.paid_amount), 0) AS "paidAmount",
            COUNT(i.id)::int                AS "installmentsCount",
            to_char(MIN(i.due_date) FILTER (WHERE i.status <> 'paid'), 'YYYY-MM-DD')
                                            AS "nextDueDate"
     FROM registrations r
     LEFT JOIN installments i ON i.registration_id = r.id
     WHERE r.event_id = $1
       AND (r.name ILIKE $2 OR r.email ILIKE $2)
     GROUP BY r.id
     ORDER BY r.created_at DESC
     LIMIT 50`,
    [eventId, pattern],
  );

  res.json(
    rows.map(({ totalAgreed, paidAmount, ...rest }) => ({
      ...rest,
      totalAgreed: Number(totalAgreed),
      paidAmount: Number(paidAmount),
    })),
  );
});

/* ═════════════════════════════ DASHBOARD ═════════════════════════════ */

/**
 * GET /api/events/:eventId/dashboard
 * Metricas clave del evento:
 * - Total esperado / recaudado / pendiente + % de avance
 * - Inscripciones completadas vs totales
 * - Cuotas VENCIDAS (morosos) y PROXIMAS a vencer (siguientes 7 dias)
 */
export const getEventDashboard = asyncHandler(async (req, res) => {
  const eventId = Number(req.params.eventId);
  if (!Number.isInteger(eventId)) throw new HttpError(400, 'eventId invalido');

  /* ── Datos del evento ─────────────────────────────────────────────── */
  const { rows: eventRows } = await pool.query(
    `SELECT id, title, event_date AS "date", base_price AS "basePrice"
     FROM events WHERE id = $1`,
    [eventId],
  );
  const event = eventRows[0];
  if (!event) throw new HttpError(404, 'Evento no encontrado');

  /* ── Consultas agregadas en paralelo ──────────────────────────────── */
  const [regRes, collectedRes, overdueRes, upcomingRes] = await Promise.all([
    // Totales de inscripcion del evento
    pool.query(
      `SELECT COUNT(*)::int                                                     AS "totalRegistrations",
              COUNT(*) FILTER (WHERE registration_status = 'fully_paid')::int   AS "completedRegistrations",
              COALESCE(SUM(total_agreed), 0)                                    AS "totalExpected"
       FROM registrations
       WHERE event_id = $1`,
      [eventId],
    ),
    // Todo lo efectivamente recaudado (suma de abonos en cuotas)
    pool.query(
      `SELECT COALESCE(SUM(i.paid_amount), 0) AS "totalCollected"
       FROM installments i
       JOIN registrations r ON r.id = i.registration_id
       WHERE r.event_id = $1`,
      [eventId],
    ),
    // Cuotas vencidas: con saldo pendiente y fecha de vencimiento pasada
    pool.query(
      `SELECT i.id,
              r.id   AS "registrationId",
              r.name AS "attendeeName",
              r.email,
              i.installment_number          AS "installmentNumber",
              i.amount,
              i.paid_amount                 AS "paidAmount",
              i.amount - i.paid_amount      AS "remaining",
              to_char(i.due_date, 'YYYY-MM-DD') AS "dueDate",
              CURRENT_DATE - i.due_date     AS "daysOverdue"
       FROM installments i
       JOIN registrations r ON r.id = i.registration_id
       WHERE r.event_id = $1
         AND i.status <> 'paid'
         AND i.due_date < CURRENT_DATE
       ORDER BY i.due_date ASC, r.name ASC`,
      [eventId],
    ),
    // Cuotas por vencer dentro de los proximos 7 dias
    pool.query(
      `SELECT i.id,
              r.id   AS "registrationId",
              r.name AS "attendeeName",
              r.email,
              i.installment_number          AS "installmentNumber",
              i.amount,
              i.paid_amount                 AS "paidAmount",
              i.amount - i.paid_amount      AS "remaining",
              to_char(i.due_date, 'YYYY-MM-DD') AS "dueDate"
       FROM installments i
       JOIN registrations r ON r.id = i.registration_id
       WHERE r.event_id = $1
         AND i.status <> 'paid'
         AND i.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
       ORDER BY i.due_date ASC, r.name ASC`,
      [eventId],
    ),
  ]);

  /* ── Metricas finales (los NUMERIC llegan como string desde pg) ──── */
  const regStats = regRes.rows[0];
  const totalExpected = Number(regStats.totalExpected);
  const totalCollected = Number(collectedRes.rows[0].totalCollected);

  const metrics = {
    totalExpected,
    totalCollected,
    totalPending: +(totalExpected - totalCollected).toFixed(2),
    progressPercent:
      totalExpected > 0 ? +((totalCollected / totalExpected) * 100).toFixed(1) : 0,
    totalRegistrations: regStats.totalRegistrations,
    completedRegistrations: regStats.completedRegistrations,
  };

  // Normaliza montos a numero para que el frontend no lide con strings
  const normalizeList = (list) =>
    list.map(({ amount, paidAmount, remaining, ...rest }) => ({
      ...rest,
      amount: Number(amount),
      paidAmount: Number(paidAmount),
      remaining: Number(remaining),
    }));

  res.json({
    event,
    metrics,
    overdue: normalizeList(overdueRes.rows),
    upcoming: normalizeList(upcomingRes.rows),
  });
});

/* ═══════════════════ REGISTRO DE ASISTENTE + CUOTAS ══════════════════ */

/**
 * POST /api/events/register
 * Registra un asistente y genera automaticamente su plan de cuotas MENSUALES.
 *
 * Body esperado: { eventId, name, email, phone?, totalAgreed, totalInstallments }
 *
 * Reglas de negocio:
 * 1. El evento debe existir y estar en el futuro.
 * 2. Las N cuotas mensuales deben caber antes de la fecha del evento.
 * 3. El monto se reparte equitativamente; el residuo de redondeo
 *    se suma a la ultima cuota (la suma siempre es exacta).
 * 4. TODO ocurre en UNA transaccion: inscripcion + cuotas se guardan juntas.
 */
export const registerAttendee = asyncHandler(async (req, res) => {
  const { eventId, name, email, phone } = req.body;
  const totalAgreed = Number(req.body.totalAgreed);
  const totalInstallments = Number(req.body.totalInstallments);

  /* ── Validaciones de entrada ────────────────────────────────────── */
  if (!eventId || !name?.trim() || !email?.trim()) {
    throw new HttpError(400, 'Los campos eventId, name y email son obligatorios');
  }
  if (!Number.isInteger(totalInstallments) || totalInstallments < 1 || totalInstallments > 24) {
    throw new HttpError(400, 'totalInstallments debe ser un entero entre 1 y 24');
  }
  if (!Number.isFinite(totalAgreed) || totalAgreed <= 0) {
    throw new HttpError(400, 'totalAgreed debe ser un monto mayor a 0');
  }

  const payload = await withTransaction(async (client) => {
    /* ── 1. El evento debe existir ────────────────────────────────── */
    const { rows } = await client.query(
      'SELECT id, title, event_date FROM events WHERE id = $1',
      [eventId],
    );
    const event = rows[0];
    if (!event) throw new HttpError(404, 'El evento indicado no existe');
    if (new Date(event.event_date) <= new Date()) {
      throw new HttpError(400, 'No se puede inscribir a un evento ya realizado');
    }

    /* ── 2. Las cuotas mensuales deben caber antes del evento ────── */
    const monthsAvailable = diffWholeMonths(new Date(), new Date(event.event_date));
    if (totalInstallments > monthsAvailable) {
      throw new HttpError(
        400,
        `El evento "${event.title}" permite como maximo ${monthsAvailable} cuota(s) mensual(es).`,
      );
    }

    /* ── 3. Crear la inscripcion ─────────────────────────────────── */
    let registration;
    try {
      const { rows: regRows } = await client.query(
        `INSERT INTO registrations (event_id, name, email, phone, total_agreed)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id,
                   event_id            AS "eventId",
                   name,
                   email,
                   phone,
                   total_agreed        AS "totalAgreed",
                   registration_status AS "registrationStatus",
                   created_at          AS "createdAt"`,
        [
          eventId,
          name.trim(),
          email.trim().toLowerCase(),
          phone ? String(phone).trim() || null : null,
          totalAgreed,
        ],
      );
      registration = regRows[0];
    } catch (err) {
      // 23505 = unique_violation: mismo email inscrito dos veces al evento
      if (err.code === '23505') {
        throw new HttpError(409, 'Ese email ya esta inscrito en este evento');
      }
      throw err;
    }

    /* ── 4. Plan de cuotas mensuales equitativas ───────────────────
       - Primera cuota: vence en un mes.
       - Ultima cuota: siempre antes de la fecha del evento.         */
    const amounts = splitEquitatively(totalAgreed, totalInstallments);
    const dueDates = amounts.map((_unused, i) => toDateOnly(addMonths(new Date(), i + 1)));

    await client.query(
      `INSERT INTO installments (registration_id, installment_number, amount, due_date)
       SELECT * FROM unnest($1::int[], $2::int[], $3::numeric[], $4::date[])`,
      [
        amounts.map(() => registration.id),
        amounts.map((_unused, i) => i + 1),
        amounts,
        dueDates,
      ],
    );

    return {
      registration,
      installments: amounts.map((amount, i) => ({
        installmentNumber: i + 1,
        amount,
        dueDate: dueDates[i],
        status: 'pending',
        paidAmount: 0,
      })),
    };
  });

  res.status(201).json(payload);
});
