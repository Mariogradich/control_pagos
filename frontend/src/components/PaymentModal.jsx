import { useEffect, useState } from 'react';

import { api } from '../api/client.js';
import Modal from './Modal.jsx';
import { formatMoney } from '../lib/format.js';

/**
 * Modal para registrar el pago de una cuota.
 * Prellena el saldo pendiente y envia el abono a la API.
 *
 * Props:
 *  - installment: cuota seleccionada { id, installmentNumber, amount, paidAmount, ... }
 *  - onClose:     cierra el modal
 *  - onSuccess:   callback tras un pago exitoso (recibe mensaje)
 */
export default function PaymentModal({ installment, onClose, onSuccess }) {
  const remaining = +(installment.amount - installment.paidAmount).toFixed(2);
  const [amount, setAmount] = useState(remaining);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Reinicia el formulario cada vez que cambia la cuota objetivo
  useEffect(() => {
    setAmount(remaining);
    setError(null);
  }, [installment?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    const value = Number(amount);
    if (!(value > 0)) {
      setError('Ingresa un monto mayor a 0.');
      return;
    }
    if (value > remaining) {
      setError(`El abono no puede exceder el saldo pendiente ($${formatMoney(remaining)}).`);
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`/installments/${installment.id}/pay`, { amount: value });
      onSuccess(
        `Pago de $${formatMoney(value)} registrado en la cuota ${installment.installmentNumber}.`,
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open
      title={`Registrar pago - Cuota ${installment.installmentNumber}`}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Resumen de la cuota */}
        <div className="grid grid-cols-3 gap-3 rounded-xl bg-slate-50 p-4 text-center text-sm">
          <div>
            <p className="text-xs text-slate-400">Monto</p>
            <p className="font-bold text-slate-700">${formatMoney(installment.amount)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Abonado</p>
            <p className="font-bold text-emerald-600">${formatMoney(installment.paidAmount)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Saldo</p>
            <p className="font-bold text-rose-500">${formatMoney(remaining)}</p>
          </div>
        </div>

        {/* Monto a abonar */}
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Monto a abonar</span>
          <input
            type="number"
            min="0.01"
            step="0.01"
            max={remaining}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoFocus
            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
          />
        </label>

        {/* Atajo: liquidar la cuota completa */}
        {remaining > 0 && amount !== remaining && (
          <button
            type="button"
            onClick={() => setAmount(remaining)}
            className="text-xs font-semibold text-teal-600 hover:text-teal-800 hover:underline"
          >
            Abonar saldo completo (${formatMoney(remaining)})
          </button>
        )}

        {error && (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        )}

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-[#fff] shadow-sm transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Procesando...' : 'Registrar pago'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
