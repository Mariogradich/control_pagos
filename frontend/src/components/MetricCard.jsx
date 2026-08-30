/** Tarjeta de metrica para el dashboard (admite contenido extra como barras). */
const ACCENTS = {
  indigo: 'text-teal-600',
  emerald: 'text-emerald-600',
  rose: 'text-rose-600',
  amber: 'text-amber-600',
  slate: 'text-slate-700',
};

export default function MetricCard({ label, value, hint, accent = 'indigo', children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className={`mt-2 text-3xl font-bold tracking-tight ${ACCENTS[accent] ?? ACCENTS.slate}`}>
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
      {/* Espacio para barra de progreso u otros extras */}
      {children}
    </div>
  );
}
