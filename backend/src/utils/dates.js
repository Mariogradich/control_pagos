/**
 * Utilidades de fechas para calcular el plan de cuotas mensuales.
 */

/**
 * Suma `months` meses a una Date.
 * Ajusta el dia cuando el mes destino no lo tiene: 31-ene + 1m => 28/29-feb.
 */
export function addMonths(date, months) {
  const result = new Date(date.getTime());
  const originalDay = result.getDate();
  result.setMonth(result.getMonth() + months);
  if (result.getDate() !== originalDay) {
    result.setDate(0); // clamp al ultimo dia del mes destino
  }
  return result;
}

/**
 * Meses completos entre dos fechas (b - a).
 * Se usa para validar cuantas cuotas mensuales caben antes del evento.
 */
export function diffWholeMonths(a, b) {
  let months =
    (b.getFullYear() - a.getFullYear()) * 12 +
    (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) months -= 1;
  return Math.max(months, 0);
}

/**
 * Formatea una Date como 'YYYY-MM-DD' usando componentes LOCALES.
 * (evita el desfase de un dia que produce toISOString con zonas UTC-negativas)
 */
export function toDateOnly(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
