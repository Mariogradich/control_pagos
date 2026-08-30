import { HttpError } from '../utils/httpError.js';

/** Responde 404 JSON para rutas no definidas. */
export function notFoundHandler(_req, res) {
  res.status(404).json({ message: 'Ruta no encontrada' });
}

/**
 * Manejador central de errores (siempre como ULTIMO middleware).
 * - HttpError   -> respuesta limpia con su codigo de estado.
 * - Otros error -> se registran en consola y devuelven 500 generico.
 */
export function errorHandler(err, _req, res, _next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ message: err.message });
  }
  console.error('[error] No controlado:', err);
  res.status(500).json({ message: 'Error interno del servidor' });
}
