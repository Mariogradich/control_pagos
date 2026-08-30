/** Indicador de carga centrado con texto opcional. */
export default function Spinner({ label = 'Cargando...' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-400">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-teal-500" />
      <p className="text-sm">{label}</p>
    </div>
  );
}
