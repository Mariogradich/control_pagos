/** Dropdown estilizado para elegir el evento activo (compartido por las vistas). */
export default function EventSelector({ events, value, onChange, disabled = false }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
        Evento
      </span>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || events.length === 0}
        className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-medium shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-200 disabled:cursor-not-allowed disabled:bg-slate-50 sm:w-80"
      >
        {events.length === 0 && <option value="">Sin eventos disponibles</option>}
        {events.map((ev) => (
          <option key={ev.id} value={ev.id}>
            {ev.title}
          </option>
        ))}
      </select>
    </label>
  );
}
