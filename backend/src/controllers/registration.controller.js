import { pool } from '../config/db.js';
import { HttpError, asyncHandler } from '../utils/httpError.js';

/**
 * GET /api/registrations/:id/status
 * Detalle completo de un asistente: datos personales, evento,
 * historial de cuotas y resumen financiero derivado.
 */
export const getRegistrationStatus = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new HttpError(400, 'id invalido');

  /* ── Cabecera de la inscripcion + datos del evento ──────────────── */
  const { rows } = await pool.query(
    `SELECT r.id,
            r.name,
            r.email,
            r.phone,
            r.total_agreed        AS "totalAgreed",
            r.registration_status AS "registrationStatus",
            r.created_at          AS "createdAt",
            e.id                  AS "eventId",
            e.title               AS "eventTitle",
            e.event_date          AS "eventDate"
     FROM registrations r
     JOIN events e ON e.id = r.event_id
     WHERE r.id = $1`,
    [id],
  );
  const registration = rows[0];
  if (!registration) throw new HttpError(404, 'Inscripcion no encontrada');

  /* ── Historial completo de cuotas ───────────────────────────────── */
  const { rows: installments } = await pool.query(
    `SELECT id,
            installment_number AS "installmentNumber",
            amount,
            to_char(due_date, 'YYYY-MM-DD') AS "dueDate",
            status,
            paid_amount AS "paidAmount",
            paid_at     AS "paidAt"
     FROM installments
     WHERE registration_id = $1
     ORDER BY installment_number ASC`,
    [id],
  );

  /* ── Resumen financiero (calculado en centavos por precision) ──── */
  const cents = (v) => Math.round(Number(v) * 100);
  const totalAgreedCents = cents(registration.totalAgreed);
  const paidCents = installments.reduce((acc, i) => acc + cents(i.paidAmount), 0);

  const summary = {
    totalAgreed: Number(registration.totalAgreed),
    paidAmount: paidCents / 100,
    remainingAmount: (totalAgreedCents - paidCents) / 100,
    progressPercent:
      totalAgreedCents > 0 ? +((paidCents / totalAgreedCents) * 100).toFixed(1) : 0,
    installmentsPaid: installments.filter((i) => i.status === 'paid').length,
    installmentsTotal: installments.length,
  };

  res.json({ registration, installments, summary });
});
