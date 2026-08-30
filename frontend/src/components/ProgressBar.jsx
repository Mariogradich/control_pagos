/** Barra de progreso horizontal (0-100%) con etiqueta porcentual. */
export default function ProgressBar({ percent, color = 'bg-teal-500', label = 'Avance' }) {
  const pct = Math.min(100, Math.max(0, percent ?? 0));

  return (
    <div className="mt-4">
      <div className="flex justify-between text-xs font-medium text-slate-500">
        <span>{label}</span>
        <span>{pct.toFixed(1)}%</span>
      </div>
      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
