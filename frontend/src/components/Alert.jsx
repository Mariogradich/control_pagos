/** Alerta reutilizable para mensajes de exito, error o informacion. */
const TYPES = {
  error: 'border-rose-200 bg-rose-50 text-rose-700',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  info: 'border-teal-200 bg-teal-50 text-teal-700',
};

export default function Alert({ type = 'info', children }) {
  return (
    <div
      role="alert"
      className={`rounded-xl border px-4 py-3 text-sm font-medium ${TYPES[type] ?? TYPES.info}`}
    >
      {children}
    </div>
  );
}
