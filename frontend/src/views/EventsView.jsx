import { useState } from 'react';

import { api } from '../api/client.js';
import { useEvents } from '../hooks/useEvents.js';
import Alert from '../components/Alert.jsx';
import Modal from '../components/Modal.jsx';
import Spinner from '../components/Spinner.jsx';
import { formatDate, formatMoney } from '../lib/format.js';

const inputCls =
  'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm shadow-sm outline-none transition placeholder:text-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-200';
const labelCls = 'mb-1 block text-sm font-medium text-slate-700';

/** Convierte un timestamp ISO a 'YYYY-MM-DDTHH:mm' (hora LOCAL) para <input type="datetime-local">. */
function toDateTimeLocal(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Hora local actual en 'YYYY-MM-DDTHH:mm' (minimo para fechas futuras al crear). */
function nowDateTimeLocal() {
  return toDateTimeLocal(new Date());
}

const EMPTY_FORM = { title: '', event_date: '', base_price: '' };

/**
 * Modal de crear/editar evento.
 * `event` null => creacion; con datos => edicion.
 * `onSave` recibe { title, event_date, base_price } y debe lanzar error en caso de fallo.
 */
function EventFormModal({ event, onClose, onSave }) {
  const isEdit = Boolean(event);
  const [form, setForm] = useState(
    event
      ? {
          title: event.title,
          event_date: toDateTimeLocal(event.date),
          base_price: event.basePrice,
        }
      : EMPTY_FORM,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const setField = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onSave({ ...form, base_price: Number(form.base_price) });
      // el padre cierra el modal solo si onSave resuelve
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open title={isEdit ? 'Editar evento' : 'Nuevo evento'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className={labelCls}>Titulo</span>
          <input
            required
            maxLength={200}
            value={form.title}
            onChange={setField('title')}
            placeholder="Ej. Conferencia Nacional de Desarrollo"
            className={inputCls}
          />
        </label>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={labelCls}>Fecha y hora</span>
            <input
              required
              type="datetime-local"
              min={isEdit ? undefined : nowDateTimeLocal()}
              value={form.event_date}
              onChange={setField('event_date')}
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className={labelCls}>Precio base ($)</span>
            <input
              required
              type="number"
              min="0"
              step="0.01"
              value={form.base_price}
              onChange={setField('base_price')}
              placeholder="480.00"
              className={inputCls}
            />
          </label>
        </div>

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
            disabled={saving}
            className="flex-1 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-[#fff] shadow-sm transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear evento'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Vista de administracion de eventos: crear, editar y eliminar. */
export default function EventsView() {
  const { events, loading, error, reload } = useEvents();

  /* modal: null | { mode: 'create' } | { mode: 'edit', event } */
  const [modal, setModal] = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [notice, setNotice] = useState(null);

  async function handleSave(payload) {
    setNotice(null);
    try {
      const isEdit = modal?.mode === 'edit';
      if (isEdit) {
        await api.put(`/events/${modal.event.id}`, payload);
        setNotice({ type: 'success', message: 'Evento actualizado correctamente.' });
      } else {
        await api.post('/events', payload);
        setNotice({ type: 'success', message: 'Evento creado correctamente.' });
      }
      setModal(null);
      reload();
    } catch (err) {
      throw err; // el modal muestra el error inline
    }
  }

  async function confirmDelete() {
    setDeletingId(confirmTarget.id);
    setNotice(null);
    try {
      await api.del(`/events/${confirmTarget.id}`);
      setConfirmTarget(null);
      setNotice({ type: 'success', message: 'Evento eliminado.' });
      reload();
    } catch (err) {
      setConfirmTarget(null);
      setNotice({ type: 'error', message: err.message });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Eventos</h2>
          <p className="mt-1 text-sm text-slate-500">
            Crea, edita o elimina los eventos que se gestionan en el sistema.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModal({ mode: 'create' })}
          className="rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-[#fff] shadow-sm transition hover:bg-teal-700"
        >
          + Nuevo evento
        </button>
      </div>

      {error && <div className="mb-5"><Alert type="error">{error}</Alert></div>}
      {notice && (
        <div className="mb-5">
          <Alert type={notice.type}>{notice.message}</Alert>
        </div>
      )}

      {loading ? (
        <Spinner label="Cargando eventos..." />
      ) : events.length === 0 ? (
        <Alert type="info">
          No hay eventos registrados. Crea el primero con el boton "+ Nuevo evento".
        </Alert>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3">Evento</th>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Precio base</th>
                  <th className="px-4 py-3">Inscripciones</th>
                  <th className="px-4 py-3">Recaudado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {events.map((ev) => (
                  <tr key={ev.id} className="transition-colors hover:bg-slate-50">
                    <td className="px-5 py-3.5 text-sm font-semibold text-slate-800">
                      {ev.title}
                    </td>
                    <td className="px-4 py-3.5 text-sm text-slate-600">
                      {formatDate(String(ev.date).slice(0, 10))}
                    </td>
                    <td className="px-4 py-3.5 text-sm text-slate-600">
                      ${formatMoney(ev.basePrice)}
                    </td>
                    <td className="px-4 py-3.5 text-sm text-slate-600">
                      {ev.registrationsCount}
                    </td>
                    <td className="px-4 py-3.5 text-sm font-semibold text-emerald-600">
                      ${formatMoney(ev.collected)}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setModal({ mode: 'edit', event: ev })}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          disabled={deletingId === ev.id}
                          onClick={() => setConfirmTarget(ev)}
                          className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {deletingId === ev.id ? 'Eliminando...' : 'Eliminar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal crear/editar */}
      {modal && (
        <EventFormModal
          event={modal.mode === 'edit' ? modal.event : null}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}

      {/* Confirmacion de eliminacion */}
      {confirmTarget && (
        <Modal open title="Eliminar evento" onClose={() => setConfirmTarget(null)}>
          <p className="text-sm text-slate-600">
            Se eliminara <strong>{confirmTarget.title}</strong> de forma permanente.
          </p>
          <p className="mt-2 text-xs text-slate-400">
            No se puede eliminar un evento que ya tenga inscripciones registradas.
          </p>
          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={() => setConfirmTarget(null)}
              className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={deletingId === confirmTarget.id}
              onClick={confirmDelete}
              className="flex-1 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-[#fff] shadow-sm transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {deletingId === confirmTarget.id ? 'Eliminando...' : 'Eliminar'}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}