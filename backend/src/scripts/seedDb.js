import 'dotenv/config';

import { pool } from '../config/db.js';
import { addMonths, toDateOnly } from '../utils/dates.js';
import { splitEquitatively } from '../utils/money.js';

/**
 * Datos de demostracion para probar el sistema de inmediato.
 * Uso: npm run db:seed  (requiere haber ejecutado antes npm run db:init)
 *
 * Crea 1 evento futuro y 3 inscripciones con estados variados:
 *  - Ana Torres ......... totalmente pagada (fully_paid)
 *  - Luis Gomez ......... pago parcial, con cuota vencida y otra por vencer
 *  - Maria Fernandez .... sin pagos y con cuota vencida
 */

/** Atajo: fecha desplazada N meses desde hoy. */
const monthsFromNow = (n) => addMonths(new Date(), n);

async function createEvent(client, { title, date, basePrice }) {
  const { rows } = await client.query(
    `INSERT INTO events (title, event_date, base_price)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [title, date.toISOString(), basePrice],
  );
  return rows[0].id;
}

/**
 * Inserta una inscripcion con su plan de cuotas equitativas.
 * - payments: mapa { numeroCuota: montoAbonado } para simular abonos.
 * - dueDateOverrides: mapa { numeroCuota: 'YYYY-MM-DD' } para simular
 *   cuotas vencidas o proximas a vencer en el dashboard.
 */
async function createRegistration(client, config) {
  const {
    eventId,
    name,
    email,
    phone,
    totalAgreed,
    totalInstallments,
    payments = {},
    dueDateOverrides = {},
  } = config;

  const { rows } = await client.query(
    `INSERT INTO registrations (event_id, name, email, phone, total_agreed)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [eventId, name, email, phone, totalAgreed],
  );
  const registrationId = rows[0].id;

  // Mismo reparto equitativo que usa la API (residuo a la ultima cuota)
  const amounts = splitEquitatively(totalAgreed, totalInstallments);
  let paidSumCents = 0;

  for (let i = 0; i < amounts.length; i++) {
    const number = i + 1;
    const amountCents = Math.round(amounts[i] * 100);
    const paid = payments[number] ?? 0;
    const paidCents = Math.round(paid * 100);
    paidSumCents += paidCents;

    // Estado de la cuota segun lo abonado
    const status =
      paidCents === 0 ? 'pending' : paidCents >= amountCents ? 'paid' : 'partial';

    // Vencimiento: mensual desde hoy, salvo que el seed lo sobreescriba
    const dueDate = dueDateOverrides[number] ?? toDateOnly(monthsFromNow(number));

    await client.query(
      `INSERT INTO installments
         (registration_id, installment_number, amount, due_date, status, paid_amount, paid_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        registrationId,
        number,
        amounts[i],
        dueDate,
        status,
        paid,
        status === 'paid' ? new Date().toISOString() : null,
      ],
    );
  }

  // Estado global coherente con los pagos aplicados
  const registrationStatus =
    paidSumCents >= Math.round(totalAgreed * 100)
      ? 'fully_paid'
      : paidSumCents > 0
        ? 'partially_paid'
        : 'pending_payment';

  await client.query(
    'UPDATE registrations SET registration_status = $1 WHERE id = $2',
    [registrationStatus, registrationId],
  );
}

/* ── Ejecucion del seed ───────────────────────────────────────────── */
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query('TRUNCATE installments, registrations, events RESTART IDENTITY CASCADE');

  const eventId = await createEvent(client, {
    title: 'Conferencia Nacional de Desarrollo 2026',
    date: monthsFromNow(4),
    basePrice: 480,
  });

  // 1) Asistente con todo pagado: 4 cuotas mensuales de 120
  await createRegistration(client, {
    eventId,
    name: 'Ana Torres',
    email: 'ana.torres@example.com',
    phone: '+52 555 111 2233',
    totalAgreed: 480,
    totalInstallments: 4,
    payments: { 1: 120, 2: 120, 3: 120, 4: 120 },
  });

  // 2) Pago parcial: cuota 1 vencida con abono parcial (moroso),
  //    cuota 2 vence hoy (proxima a vencer), cuota 3 a un mes
  await createRegistration(client, {
    eventId,
    name: 'Luis Gomez',
    email: 'luis.gomez@example.com',
    phone: '+52 555 444 5566',
    totalAgreed: 360,
    totalInstallments: 3,
    payments: { 1: 60 },
    dueDateOverrides: {
      1: toDateOnly(monthsFromNow(-1)),
      2: toDateOnly(new Date()),
      3: toDateOnly(monthsFromNow(1)),
    },
  });

  // 3) Sin ningun pago y con la primera cuota ya vencida
  await createRegistration(client, {
    eventId,
    name: 'Maria Fernandez',
    email: 'maria.fernandez@example.com',
    phone: null,
    totalAgreed: 500,
    totalInstallments: 2,
    dueDateOverrides: { 1: toDateOnly(monthsFromNow(-1)) },
  });

  await client.query('COMMIT');
  console.log('[OK] Datos de demostracion insertados (1 evento + 3 inscripciones).');
} catch (err) {
  await client.query('ROLLBACK').catch(() => {});
  console.error('[ERROR] El seed fallo:', err.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
