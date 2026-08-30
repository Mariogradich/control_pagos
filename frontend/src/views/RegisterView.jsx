import { useMemo, useState } from 'react';

import { api } from '../api/client.js';
import { useEvents } from '../hooks/useEvents.js';
import Alert from '../components/Alert.jsx';
import EventSelector from '../components/EventSelector.jsx';
import Spinner from '../components/Spinner.jsx';
import { addMonths, monthsUntil, toDateOnly } from '../lib/dates.js';
import { formatDate, formatMoney, splitEquitatively } from '../lib/format.js';

const INITIAL_FORM = {
  eventId: '',
  name: '',
  email: '',
  phone: '',
  totalAgreed: '',
  totalInstallments: 4,
};

const inputCls =
  'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm shadow-sm outline-none transition placeholder:text-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-200';
const labelCls = 'mb-1 block text-sm font-medium text-slate-700';

/** Vista de inscripcion de asistentes con previsualizacion del plan de cuotas. */
export default function RegisterView() {
  const { events, loading: loadingEvents, error: eventsError } = useEvents();
  const [form, setForm] = useState(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', message }

  const selectedEvent =
    events.find((e) => e.id === Number(form.eventId)) ?? null;

  // Maximo de cuotas que caben antes del evento (misma regla que el backend)
  const monthsFromEvent = selectedEvent
    ? Math.min(24, monthsUntil(selectedEvent.date))
    : 24;
  const eventTooClose = monthsFromEvent < 1;
  const maxInstallments = Math.max(monthsFromEvent, 1); // el slider nunca queda vacio

  /* ── Previsualizacion dinamica del plan ─────────────────────────── */
  const preview = useMemo(() => {
    const total = Number(form.totalAgreed);
    const n = Number(form.totalInstallments);
    if (!selectedEvent || !(total > 0) || !(n > 0)) return null;

    const perInstallment = total / n;
    // Mismo reparto equitativo que el backend: residuo a la ultima cuota
    const schedule = splitEquitatively(total, n).map((amount, i) => ({
      number: i + 1,
      amount,
      dueDate: toDateOnly(addMonths(new Date(), i + 1)),
    }));

    return { perInstallment, schedule };
  }, [form.totalAgreed, form.totalInstallments, selectedEvent]);

  /* ── Handlers ───────────────────────────────────────────────────── */
  const setField = (field) => (e) => {
    setFeedback(null);
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  // Al cambiar de evento reajustamos el numero de cuotas al maximo permitido
  function handleEventChange(value) {
    setFeedback(null);
    setForm((prev) => {
      const ev = events.find((e) => e.id === Number(value));
      const max = ev ? Math.min(24, Math.max(monthsUntil(ev.date), 1)) : 24;
      const current = Number(prev.totalInstallments) || 1;
      return { ...prev, eventId: value, totalInstallments: Math.min(current, max) };
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.eventId) {
      setFeedback({ type: 'error', message: 'Selecciona un evento.' });
      return;
    }
    if (eventTooClose) {
      setFeedback({
        type: 'error',
        message:
          'El evento se realiza en menos de un mes: no caben cuotas mensuales.',
      });
      return;
    }

    setSubmitting(true);
    setFeedback(null);
    try {
      const result = await api.post('/events/register', {
        eventId: Number(form.eventId),
        name: form.name,
        email: form.email,
        phone: form.phone,
        totalAgreed: Number(form.totalAgreed),
        totalInstallments: Number(form.totalInstallments),
      });

      setFeedback({
        type: 'success',
        message: `Inscripcion creada para ${result.registration.name}: se generaron ${result.installments.length} cuota(s) mensual(es).`,
      });
      setForm({ ...INITIAL_FORM, eventId: form.eventId }); // conservamos el evento elegido
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  /* ── Render ─────────────────────────────────────────────────────── */
  if (loadingEvents) return <Spinner label="Cargando eventos..." />;
  if (eventsError) return <Alert type="error">{eventsError}</Alert>;
  if (events.length === 0)
    return (
      <Alert type="info">
        No hay eventos disponibles. Ejecuta <code>npm run db:seed</code> en /backend.
      </Alert>
    );

  return (
    <section className="mx-auto max-w-5xl">
      <header className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          Inscripcion de asistente
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Registra al participante y genera automaticamente su plan de cuotas mensuales.
        </p>
      </header>

      {feedback && (
        <div className="mb-5">
          <Alert type={feedback.type}>{feedback.message}</Alert>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        {/* ── Formulario ─────────────────────────────────────────── */}
        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <EventSelector events={events} value={form.eventId} onChange={handleEventChange} />

          <label className="block">
            <span className={labelCls}>Nombre completo</span>
            <input
              required
              value={form.name}
              onChange={setField('name')}
              placeholder="Ej. Ana Torres"
              className={inputCls}
            />
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className={labelCls}>Email</span>
              <input
                required
                type="email"
                value={form.email}
                onChange={setField('email')}
                placeholder="ana@ejemplo.com"
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className={labelCls}>Telefono</span>
              <input
                value={form.phone}
                onChange={setField('phone')}
                placeholder="+52 555 000 0000"
                className={inputCls}
              />
            </label>
          </div>

          <label className="block">
            <span className={labelCls}>Monto acordado total ($)</span>
            <input
              required
              type="number"
              min="1"
              step="0.01"
              value={form.totalAgreed}
              onChange={setField('totalAgreed')}
              placeholder="480.00"
              className={inputCls}
            />
          </label>

          {/* Slider de numero de cuotas */}
          <div>
            <div className="flex items-center justify-between">
              <span className={labelCls}>Numero de cuotas mensuales</span>
              <span className="rounded-lg bg-teal-50 px-3 py-1 text-sm font-bold text-teal-600">
                {form.totalInstallments}
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={maxInstallments}
              step={1}
              disabled={eventTooClose}
              value={form.totalInstallments}
              onChange={setField('totalInstallments')}
              className="mt-2 w-full accent-teal-600 disabled:cursor-not-allowed disabled:opacity-50"
            />
            {eventTooClose ? (
              <p className="mt-1 text-xs font-medium text-rose-600">
                El evento ocurre en menos de un mes: no caben cuotas mensuales.
              </p>
            ) : (
              <p className="mt-1 text-xs text-slate-400">
                Maximo {maxInstallments} cuota(s), limitado por la fecha del evento.
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting || eventTooClose}
            className="w-full rounded-xl bg-teal-600 px-4 py-3 text-sm font-semibold text-[#fff] shadow-sm transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting
              ? 'Procesando...'
              : eventTooClose
                ? 'Evento sin cuotas disponibles'
                : 'Registrar inscripcion'}
          </button>
        </form>

        {/* ── Previsualizacion del plan ──────────────────────────── */}
        <aside className="h-fit rounded-2xl bg-gradient-to-br from-teal-600 to-emerald-600 p-6 text-[#fff] shadow-lg lg:sticky lg:top-24">
          <h3 className="text-xs font-bold uppercase tracking-widest text-teal-200">
            Plan estimado
          </h3>

          {preview ? (
            <>
              <p className="mt-3 text-4xl font-extrabold tracking-tight">
                ${formatMoney(preview.perInstallment)}
              </p>
              <p className="text-sm text-teal-100">
                por cuota · {form.totalInstallments} pago(s) mensual(es)
              </p>

              <ul className="mt-5 space-y-2.5 border-t border-white/20 pt-4 text-sm">
                {preview.schedule.map((c) => (
                  <li key={c.number} className="flex items-baseline justify-between gap-2">
                    <span className="text-teal-100">Cuota {c.number}</span>
                    <span className="ml-auto font-semibold">${formatMoney(c.amount)}</span>
                    <span className="w-20 text-right text-xs text-teal-200">
                      {formatDate(c.dueDate)}
                    </span>
                  </li>
                ))}
              </ul>

              <p className="mt-4 text-xs leading-relaxed text-teal-200">
                La ultima cuota se ajusta por redondeo para que la suma sea exactamente el monto
                acordado. Los vencimientos son mensuales a partir de hoy.
              </p>
            </>
          ) : (
            <p className="mt-4 text-sm text-teal-100">
              Selecciona un evento e ingresa el monto acordado para ver la estimacion del plan.
            </p>
          )}
        </aside>
      </div>
    </section>
  );
}
