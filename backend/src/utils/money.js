/**
 * Utilidades para manejar dinero con precision.
 * Trabajamos en "centavos" (enteros) internamente para evitar errores de
 * coma flotante, y solo convertimos a decimal al persistir o responder.
 */

/** Convierte un monto decimal (ej. 1499.99) a centavos enteros (149999). */
export function toCents(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new Error(`Monto invalido: ${value}`);
  }
  return Math.round(n * 100);
}

/** Convierte centavos enteros a decimal con 2 posiciones (149999 -> 1499.99). */
export function fromCents(cents) {
  return Math.round(cents) / 100;
}

/**
 * Divide `total` en `parts` montos EQUITATIVOS.
 * El residuo del redondeo a centavos se agrega a la ULTIMA parte,
 * garantizando que la suma sea exactamente igual al total acordado.
 *
 * Ejemplo: splitEquitatively(100, 3) => [33.33, 33.33, 33.34]
 */
export function splitEquitatively(total, parts) {
  const totalCents = toCents(total);
  const base = Math.floor(totalCents / parts);
  const remainder = totalCents - base * parts;

  return Array.from({ length: parts }, (_unused, i) =>
    fromCents(base + (i === parts - 1 ? remainder : 0)),
  );
}
