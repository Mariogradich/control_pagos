/**
 * Error HTTP con codigo de estado asociado.
 * Se lanza desde los controladores para producir respuestas controladas.
 */
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

/**
 * Envuelve handlers asincronos de Express y propaga cualquier error
 * al middleware central de manejo de errores (next).
 */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
