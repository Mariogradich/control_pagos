/** Etiqueta de estado (inscripcion o cuota) con colores semanticos. */
const STYLES = {
  pending_payment: 'bg-slate-100 text-slate-600 ring-slate-300/60',
  partially_paid: 'bg-amber-100 text-amber-700 ring-amber-300/60',
  fully_paid: 'bg-emerald-100 text-emerald-700 ring-emerald-300/60',
  pending: 'bg-slate-100 text-slate-600 ring-slate-300/60',
  partial: 'bg-amber-100 text-amber-700 ring-amber-300/60',
  paid: 'bg-emerald-100 text-emerald-700 ring-emerald-300/60',
};

const LABELS = {
  pending_payment: 'Pago pendiente',
  partially_paid: 'Pago parcial',
  fully_paid: 'Pagado completo',
  pending: 'Pendiente',
  partial: 'Parcial',
  paid: 'Pagada',
};

export default function Badge({ status }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${
        STYLES[status] ?? STYLES.pending
      }`}
    >
      {LABELS[status] ?? status}
    </span>
  );
}
