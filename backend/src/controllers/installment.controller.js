import { pool, withTransaction } from '../config/db.js';
import { HttpError, asyncHandler } from '../utils/httpError.js';
import { fromCents, toCents } from '../utils/money.js';

/**
 * POST /api/installments/:id/pay
 * Registra el pago (parcial o total) de una cuota.
 *
 * Body: { amount }
 *
 * Reglas de negocio (todo dentro de UNA transaccion):
 * 1. La cuota no puede estar ya pagada por completo.
 * 2. El abono no puede superar el saldo restante de la cuota.
 * 3. Al cubrir el monto completo la cuota pasa a 'paid' (se guarda paid_at).
 *    Un abono menor la marca como 'partial'.
 * 4. Si TODAS las cuotas de la inscripcion quedan pagadas,
 *    la inscripcion pasa a 'fully_paid'.
 */
export const payInstallment = asyncHandler(async (req, res) => {
  const installmentId = Number(req.params.id);
  const paymentAmount = Number(req.body?.amount);

  if (!Number.isInteger(installmentId)) throw new HttpError(400, 'id de cuota invalido');
  if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
    throw new HttpError(400, 'El campo amount debe ser un monto mayor a 0');
  }

  const result = await withTransaction(async (client) => {
    /* ── 1. Verificar que la cuota exista ─────────────────────────── */
    const { rows: found } = await client.query(
      'SELECT registration_id AS "registrationId" FROM installments WHERE id = $1',
      [installmentId],
    );
    const installmentRef = found[0];
    if (!installmentRef) throw new HttpError(404, 'Cuota no encontrada');

    /* ── 2. Bloqueo pesimista de la inscripcion padre ──────────────
       Serializa pagos concurrentes sobre la misma inscripcion y evita
       condiciones de carrera al recalcular el estado global.        */
    await client.query('SELECT id FROM registrations WHERE id = $1 FOR UPDATE', [
      installmentRef.registrationId,
    ]);

    /* ── 3. Estado fresco de la cuota (ya bajo bloqueo) ──────────── */
    const { rows: instRows } = await client.query(
      `SELECT id, amount, paid_amount AS "paidAmount", status
       FROM installments WHERE id = $1`,
      [installmentId],
    );
    const installment = instRows[0];

    if (installment.status === 'paid') {
      throw new HttpError(409, 'Esta cuota ya esta completamente pagada');
    }

    /* ── 4. El abono no debe exceder el saldo pendiente ──────────── */
    const remainingCents = toCents(installment.amount) - toCents(installment.paidAmount);
    const paymentCents = toCents(paymentAmount);
    if (paymentCents > remainingCents) {
      throw new HttpError(
        400,
        `El abono excede el saldo pendiente de la cuota (${fromCents(remainingCents)}).`,
      );
    }

    /* ── 5. Aplicar el abono a la cuota ──────────────────────────── */
    const newPaidCents = toCents(installment.paidAmount) + paymentCents;
    const newStatus = newPaidCents >= toCents(installment.amount) ? 'paid' : 'partial';

    const paidAt = newStatus === 'paid' ? new Date().toISOString() : null;
    const { rows: updated } = await client.query(
      `UPDATE installments
         SET paid_amount = $1,
             status      = $2,
             paid_at     = COALESCE($3, paid_at)
       WHERE id = $4
       RETURNING id,
                 installment_number AS "installmentNumber",
                 amount,
                 status,
                 paid_amount AS "paidAmount",
                 paid_at     AS "paidAt",
                 to_char(due_date, 'YYYY-MM-DD') AS "dueDate"`,
      [fromCents(newPaidCents), newStatus, paidAt, installmentId],
    );

    /* ── 6. Recalcular el estado global de la inscripcion ────────── */
    const { rows: stats } = await client.query(
      `SELECT COUNT(*)::int                                AS total,
              COUNT(*) FILTER (WHERE status = 'paid')::int AS fully_paid,
              COALESCE(SUM(paid_amount), 0)                AS paid_sum
       FROM installments
       WHERE registration_id = $1`,
      [installmentRef.registrationId],
    );
    const s = stats[0];
    // Todas las cuotas cubiertas -> fully_paid; con algun abono -> partially_paid
    const registrationStatus =
      s.fully_paid === s.total
        ? 'fully_paid'
        : Number(s.paid_sum) > 0
          ? 'partially_paid'
          : 'pending_payment';

    await client.query(
      'UPDATE registrations SET registration_status = $1 WHERE id = $2',
      [registrationStatus, installmentRef.registrationId],
    );

    return {
      installment: {
        ...updated[0],
        amount: Number(updated[0].amount),
        paidAmount: Number(updated[0].paidAmount),
      },
      registrationStatus,
    };
  });

  res.json(result);
});
