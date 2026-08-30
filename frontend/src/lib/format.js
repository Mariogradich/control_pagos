/** Formatea montos: 1234.5 => "1,234.50" (el simbolo "$" se agrega en la UI). */
export function formatMoney(value) {
  return new Intl.NumberFormat('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));
}

/** Divide `total` en `parts` montos equitativos (el residuo va a la ultima).
 * Reproduce el reparto del backend (en centavos) para que la preview
 * coincida exactamente con las cuotas que se generan al guardar. */
export function splitEquitatively(total, parts) {
  const totalCents = Math.round(Number(total ?? 0) * 100);
  const base = Math.floor(totalCents / parts);
  const remainder = totalCents - base * parts;
  return Array.from({ length: parts }, (_unused, i) =>
    (base + (i === parts - 1 ? remainder : 0)) / 100,
  );
}

/** Formatea fechas 'YYYY-MM-DD' => "12 sep 2026" sin desfase de zona horaria. */
export function formatDate(isoDate) {
  if (!isoDate) return '-';
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Formatea un timestamp ISO completo => "12 sep 2026, 18:30". */
export function formatDateTime(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('es', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Dias restantes hasta una fecha 'YYYY-MM-DD' (negativo si ya paso). */
export function daysUntil(isoDate) {
  if (!isoDate) return null;
  const [y, m, d] = isoDate.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}
