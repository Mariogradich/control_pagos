import { useCallback, useEffect, useState } from 'react';

import { api } from '../api/client.js';
import { useEvents } from '../hooks/useEvents.js';
import Alert from '../components/Alert.jsx';
import Badge from '../components/Badge.jsx';
import EventSelector from '../components/EventSelector.jsx';
import PaymentModal from '../components/PaymentModal.jsx';
import ProgressBar from '../components/ProgressBar.jsx';
import Spinner from '../components/Spinner.jsx';
import { daysUntil, formatDate, formatDateTime, formatMoney } from '../lib/format.js';

const inputCls =
  'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm shadow-sm outline-none transition placeholder:text-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-200';

/** Fila de cuota con resaltado por urgencia (rojo vencida / amarillo proxima). */
function InstallmentRow({ installment, onPay }) {
  const unpaid = installment.status !== 'paid';
  const days = daysUntil(installment.dueDate);
  const overdue = unpaid && days < 0;
  const soon = unpaid && days >= 0 && days <= 7;

  const rowTone = overdue
    ? 'bg-rose-50/70 hover:bg-rose-50'
    : soon
      ? 'bg-amber-50/70 hover:bg-amber-50'
      : 'hover:bg-slate-50';

  return (
    <tr className={`${rowTone} transition-colors`}>
      <td className="px-4 py-3 text-sm font-bold text-slate-700">
        #{installment.installmentNumber}
      </td>
      <td className="px-4 py-3 text-sm">
        <p className="font-semibold text-slate-800">${formatMoney(installment.amount)}</p>
        {installment.paidAmount > 0 && (
          <p className="text-xs text-emerald-600">Abonado ${formatMoney(installment.paidAmount)}</p>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-slate-600">{formatDate(installment.dueDate)}</td>
      <td className="px-4 py-3">
        <Badge status={installment.status} />
        {overdue && (
          <span className="ml-2 text-xs font-semibold text-rose-600">
            {Math.abs(days)} dia(s) de atraso
          </span>
        )}
        {soon && (
          <span className="ml-2 text-xs font-semibold text-amber-600">
            {days === 0 ? 'Vence hoy' : `Faltan ${days} dia(s)`}
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <button
          type="button"
          disabled={!unpaid}
          onClick={() => onPay(installment)}
          className={
            unpaid
              ? 'rounded-lg bg-teal-600 px-3.5 py-2 text-xs font-semibold text-[#fff] shadow-sm transition hover:bg-teal-700'
              : 'cursor-not-allowed rounded-lg bg-slate-100 px-3.5 py-2 text-xs font-semibold text-slate-400'
          }
        >
          {unpaid ? 'Registrar pago' : 'Pagada'}
        </button>
      </td>
    </tr>
  );
}

/**
 * Panel de control de pagos:
 * 1. Buscador de asistentes (nombre o email) del evento activo.
 * 2. Al seleccionar un asistente se despliega su historial de cuotas.
 * 3. Boton "Registrar pago" que abre el modal y actualiza via API.
 */
export default function PaymentsView() {
  const { events, loading: loadingEvents } = useEvents();
  const [eventId, setEventId] = useState(null);

  /* Buscador */
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  /* Asistente seleccionado + detalle completo */
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  /* Modal de pago + notificaciones */
  const [payTarget, setPayTarget] = useState(null);
  const [notice, setNotice] = useState(null); // { type, message }

  useEffect(() => {
    if (events.length > 0 && eventId == null) setEventId(events[0].id);
  }, [events, eventId]);

  /** Carga la lista de asistentes segun evento y termino de busqueda. */
  const loadResults = useCallback(async (evId, term) => {
    if (evId == null) return;
    setSearching(true);
    try {
      const data = await api.get(
        `/events/${evId}/registrations?search=${encodeURIComponent(term)}`,
      );
      setResults(data);
    } catch (err) {
      setNotice({ type: 'error', message: err.message });
    } finally {
      setSearching(false);
    }
  }, []);

  // Debounce del buscador: consulta 300ms despues de la ultima tecla
  useEffect(() => {
    if (eventId == null) return undefined;
    const timer = setTimeout(() => loadResults(eventId, search), 300);
    return () => clearTimeout(timer);
  }, [eventId, search, loadResults]);

  /** Descarga el detalle completo (/registrations/:id/status). */
  const loadDetail = useCallback(async (regId) => {
    setDetailLoading(true);
    try {
      const data = await api.get(`/registrations/${regId}/status`);
      setDetail(data);
    } catch (err) {
      setNotice({ type: 'error', message: err.message });
    } finally {
      setDetailLoading(false);
    }
  }, []);

  function handleSelect(registration) {
    setSelectedId(registration.id);
    setDetail(null);
    setNotice(null);
    loadDetail(registration.id);
  }

  /** Tras un pago exitoso refrescamos el detalle y la lista de resultados. */
  async function handlePaymentSuccess(message) {
    setPayTarget(null);
    setNotice({ type: 'success', message });
    if (selectedId != null) await loadDetail(selectedId);
    loadResults(eventId, search);
  }

  if (loadingEvents) return <Spinner label="Cargando eventos..." />;
  if (events.length === 0)
    return (
      <Alert type="info">
        No hay eventos disponibles. Ejecuta <code>npm run db:seed</code> en /backend.
      </Alert>
    );

  const reg = detail?.registration;
  const summary = detail?.summary;

  return (
    <section>
      {/* Encabezado */}
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Control de pagos
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Busca al asistente y registra sus abonos cuota por cuota.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
              Buscar asistente
            </span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nombre o email..."
              className={inputCls}
            />
          </label>
          <EventSelector events={events} value={eventId} onChange={(v) => setEventId(Number(v))} />
        </div>
      </div>

      {notice && (
        <div className="mb-5">
          <Alert type={notice.type}>{notice.message}</Alert>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_1fr]">
        {/* ── Lista de resultados del buscador ─────────────────────── */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="text-sm font-bold text-slate-700">
              Asistentes{' '}
              <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
                {searching ? '...' : results.length}
              </span>
            </h3>
          </div>

          {searching ? (
            <Spinner label="Buscando..." />
          ) : results.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-400">
              Sin coincidencias para "{search || 'todos los asistentes'}"
            </p>
          ) : (
            <ul className="max-h-[560px] divide-y divide-slate-100 overflow-y-auto">
              {results.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(r)}
                    className={`w-full px-5 py-3.5 text-left transition-colors ${
                      selectedId === r.id
                        ? 'border-l-4 border-teal-600 bg-teal-50/60'
                        : 'border-l-4 border-transparent hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-slate-800">{r.name}</p>
                      <Badge status={r.registrationStatus} />
                    </div>
                    <p className="mt-0.5 truncate text-xs text-slate-400">{r.email}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Pagado ${formatMoney(r.paidAmount)} de ${formatMoney(r.totalAgreed)}
                      {r.nextDueDate && ` · proximo vence ${formatDate(r.nextDueDate)}`}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ── Detalle del asistente seleccionado ───────────────────── */}
        {!selectedId ? (
          <div className="flex items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/50 p-12 text-center">
            <p className="text-sm text-slate-400">
              Selecciona un asistente de la lista para ver y gestionar sus cuotas.
            </p>
          </div>
        ) : detailLoading ? (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <Spinner label="Cargando detalle..." />
          </div>
        ) : (
          detail && (
            <div className="space-y-6">
              {/* Resumen financiero */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">{reg.name}</h3>
                    <p className="text-sm text-slate-500">
                      {reg.email}
                      {reg.phone ? ` · ${reg.phone}` : ''}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Evento: {reg.eventTitle}
                    </p>
                  </div>
                  <Badge status={reg.registrationStatus} />
                </div>

                <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs text-slate-400">Acordado</p>
                    <p className="font-bold text-slate-700">${formatMoney(summary.totalAgreed)}</p>
                  </div>
                  <div className="rounded-xl bg-emerald-50 p-3">
                    <p className="text-xs text-emerald-600/70">Pagado</p>
                    <p className="font-bold text-emerald-600">
                      ${formatMoney(summary.paidAmount)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-rose-50 p-3">
                    <p className="text-xs text-rose-500">Pendiente</p>
                    <p className="font-bold text-rose-600">
                      ${formatMoney(summary.remainingAmount)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-teal-50 p-3">
                    <p className="text-xs text-teal-400">Cuotas pagadas</p>
                    <p className="font-bold text-teal-600">
                      {summary.installmentsPaid}/{summary.installmentsTotal}
                    </p>
                  </div>
                </div>

                <ProgressBar percent={summary.progressPercent} color="bg-emerald-500" />
              </div>

              {/* Tabla de cuotas */}
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-5 py-4">
                  <h3 className="text-sm font-bold text-slate-700">Historial de cuotas</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-100">
                    <thead>
                      <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                        <th className="px-4 py-3">Cuota</th>
                        <th className="px-4 py-3">Monto</th>
                        <th className="px-4 py-3">Vencimiento</th>
                        <th className="px-4 py-3">Estado</th>
                        <th className="px-4 py-3 text-right">Accion</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {detail.installments.map((inst) => (
                        <InstallmentRow
                          key={inst.id}
                          installment={inst}
                          onPay={(i) => {
                            setNotice(null);
                            setPayTarget(i);
                          }}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {detail.installments.some((i) => i.paidAt) && (
                <p className="text-xs text-slate-400">
                  Ultimos abonos:{' '}
                  {detail.installments
                    .filter((i) => i.paidAt)
                    .map((i) => `Cuota ${i.installmentNumber}: ${formatDateTime(i.paidAt)}`)
                    .join(' · ')}
                </p>
              )}
            </div>
          )
        )}
      </div>

      {/* Modal de registro de pago */}
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
