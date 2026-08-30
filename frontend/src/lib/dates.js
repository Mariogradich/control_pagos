/**
 * Replicas (frontend) de las utilidades de fechas del backend.
 * Se usan para previsualizar el plan de cuotas antes de enviar el formulario.
 */

/** Suma `months` meses a una Date con clamp de dia (31-ene + 1m => 28-feb). */
export function addMonths(date, months) {
  const result = new Date(date.getTime());
  const originalDay = result.getDate();
  result.setMonth(result.getMonth() + months);
  if (result.getDate() !== originalDay) result.setDate(0);
  return result;
}

/** Meses completos desde hoy hasta una fecha futura (Date o string ISO). */
export function monthsUntil(dateLike) {
  const target = typeof dateLike === 'string' ? new Date(dateLike) : dateLike;
  const now = new Date();
  let months =
    (target.getFullYear() - now.getFullYear()) * 12 +
    (target.getMonth() - now.getMonth());
  if (target.getDate() < now.getDate()) months -= 1;
  return Math.max(months, 0);
}

/** Convierte una Date a 'YYYY-MM-DD' usando componentes locales. */
export function toDateOnly(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
