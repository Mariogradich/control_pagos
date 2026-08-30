import { useCallback, useEffect, useState } from 'react';

import { api } from '../api/client.js';
import { useEvents } from '../hooks/useEvents.js';
import Alert from '../components/Alert.jsx';
import EventSelector from '../components/EventSelector.jsx';
import MetricCard from '../components/MetricCard.jsx';
import PaymentModal from '../components/PaymentModal.jsx';
import ProgressBar from '../components/ProgressBar.jsx';
import Spinner from '../components/Spinner.jsx';
import { daysUntil, formatDate, formatMoney } from '../lib/format.js';

/* Paletas visuales de los paneles de cuotas (rojo = vencidas, amarillo = proximas) */
const TONES = {
  rose: {
    border: 'border-rose-200',
    dot: 'bg-rose-500',
    chip: 'bg-rose-100 text-rose-700',
    metaText: 'text-rose-600',
  },
  amber: {
    border: 'border-amber-200',
    dot: 'bg-amber-400',
    chip: 'bg-amber-100 text-amber-700',
    metaText: 'text-amber-600',
  },
};

/**
 * Panel que lista cuotas VENCIDAS o PROXIMAS a vencer.
 * `metaLabel(item)` genera el texto secundario de cada fila.
 */
function InstallmentListPanel({ title, subtitle, tone, items, metaLabel, onPay }) {
  const t = TONES[tone];

  return (
    <div className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${t.border}`}>
      <div className="border-b border-slate-100 px-5 py-4">
        <h3 className="flex items-center gap-2 font-bold text-slate-800">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${t.dot}`} />
          {title}
          <span className={`ml-auto rounded-full px-2 py-0.5 text-xs font-semibold ${t.chip}`}>
            {items.length} cuota(s)
          </span>
        </h3>
        <p className="mt-0.5 pl-[18px] text-xs text-slate-400">{subtitle}</p>
      </div>

      {items.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-slate-400">
          No hay cuotas en esta categoria
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((it) => (
            <li
              key={it.id}
              className="flex items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-slate-50"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800">{it.attendeeName}</p>
                <p className="truncate text-xs text-slate-400">
                  Cuota {it.installmentNumber} · vence {formatDate(it.dueDate)}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-bold text-slate-800">${formatMoney(it.remaining)}</p>
                <p className={`text-xs font-semibold ${t.metaText}`}>{metaLabel(it)}</p>
                {onPay && (
                  <button
                    type="button"
                    onClick={() => onPay(it)}
                    className="mt-2 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-[#fff] shadow-sm transition hover:bg-teal-700"
                  >
                    Registrar pago
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Vista principal del administrador con metricas y alertas de cobranza. */
export default function DashboardView() {
  const { events, loading: loadingEvents } = useEvents();
  const [eventId, setEventId] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /* Pago rapido desde los paneles + refresh tras cobrar */
  const [reloadKey, setReloadKey] = useState(0);
  const [payTarget, setPayTarget] = useState(null);
  const [notice, setNotice] = useState(null);

  // Al cargar los eventos seleccionamos el primero por defecto
  useEffect(() => {
    if (events.length > 0 && eventId == null) setEventId(events[0].id);
  }, [events, eventId]);

  const loadDashboard = useCallback(async (evId, isCancelled) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get(`/events/${evId}/dashboard`);
      if (!isCancelled()) setDashboard(data);
    } catch (err) {
      if (!isCancelled()) setError(err.message);
    } finally {
      if (!isCancelled()) setLoading(false);
    }
  }, []);

  // Consulta el dashboard cada vez que cambia el evento o se cobra una cuota
  useEffect(() => {
    if (eventId == null) return undefined;
    let cancelled = false;
    loadDashboard(eventId, () => cancelled);
    return () => {
      cancelled = true;
    };
  }, [eventId, reloadKey, loadDashboard]);

  /** Tras un pago exitoso cerramos el modal y recargamos las metricas. */
  function handlePaymentSuccess(message) {
    setPayTarget(null);
    setNotice({ type: 'success', message });
    setReloadKey((k) => k + 1);
  }

  if (loadingEvents) return <Spinner label="Cargando eventos..." />;

  if (events.length === 0) {
    return (
      <Alert type="info">
        No hay eventos registrados. Ejecuta <code>npm run db:init</code> y{' '}
        <code>npm run db:seed</code> dentro de /backend para crear datos de prueba.
      </Alert>
    );
  }

  const metrics = dashboard?.metrics;
  const eventDate = dashboard?.event?.date ? String(dashboard.event.date).slice(0, 10) : '';

  return (
    <section>
      {/* Encabezado + selector de evento */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Dashboard del evento
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {dashboard
              ? `${dashboard.event.title}${eventDate ? ` · ${formatDate(eventDate)}` : ''}`
              : 'Selecciona un evento'}
          </p>
        </div>
        <EventSelector events={events} value={eventId} onChange={(v) => setEventId(Number(v))} />
      </div>

      {loading && <Spinner label="Calculando metricas..." />}
      {!loading && error && <Alert type="error">{error}</Alert>}
      {!loading && notice && (
        <div className="mb-4">
          <Alert type={notice.type}>{notice.message}</Alert>
        </div>
      )}

      {!loading && dashboard && metrics && (
        <>
          {/* ── Tarjetas de metricas ─────────────────────────────── */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard
              label="Total Recaudado"
              value={`$${formatMoney(metrics.totalCollected)}`}
              hint={`Esperado: $${formatMoney(metrics.totalExpected)}`}
              accent="emerald"
            >
              <ProgressBar percent={metrics.progressPercent} color="bg-emerald-500" />
            </MetricCard>

            <MetricCard
              label="Monto Pendiente"
              value={`$${formatMoney(metrics.totalPending)}`}
              hint="Saldo aun sin cobrar a los asistentes"
              accent="rose"
            />

            <MetricCard
              label="Inscripciones Completadas"
              value={`${metrics.completedRegistrations}/${metrics.totalRegistrations}`}
              hint="Asistentes con todo pagado"
              accent="indigo"
            >
              <ProgressBar
                percent={
                  metrics.totalRegistrations > 0
                    ? (metrics.completedRegistrations / metrics.totalRegistrations) * 100
                    : 0
                }
                color="bg-teal-500"
                label="Tasa de finalizacion"
              />
            </MetricCard>
          </div>

          {/* ── Cuotas vencidas y proximas a vencer ──────────────── */}
          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <InstallmentListPanel
              title="Cuotas vencidas"
              subtitle="Asistentes morosos con pago pendiente"
              tone="rose"
              items={dashboard.overdue}
              metaLabel={(it) =>
                `${it.daysOverdue} ${it.daysOverdue === 1 ? 'dia' : 'dias'} de atraso`
              }
              onPay={(item) => {
                setNotice(null);
                setPayTarget(item);
              }}
            />
            <InstallmentListPanel
              title="Proximas a vencer"
              subtitle="Vencen en los siguientes 7 dias"
              tone="amber"
              items={dashboard.upcoming}
              metaLabel={(it) => {
                const d = daysUntil(it.dueDate);
                if (d === 0) return 'Vence hoy';
                return d === 1 ? 'Vence manana' : `Faltan ${d} dias`;
              }}
              onPay={(item) => {
                setNotice(null);
                setPayTarget(item);
              }}
            />
          </div>
        </>
      )}

      {/* Modal de registro de pago rapido */}
      {payTarget && (
        <PaymentModal
          installment={payTarget}
          onClose={() => setPayTarget(null)}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </section>
  );
}
