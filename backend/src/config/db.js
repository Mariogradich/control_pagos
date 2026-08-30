import 'dotenv/config';
import pg from 'pg';

/**
 * Pool de conexiones compartido por toda la aplicacion.
 * La cadena de conexion se toma de DATABASE_URL (archivo .env).
 */
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

// Evita que un error oculto del pool tumbe el proceso sin aviso
pool.on('error', (err) => console.error('[db] Error inesperado en el pool:', err));

/**
 * Ejecuta `fn(client)` dentro de una transaccion PostgreSQL:
 * - COMMIT si todo termina bien.
 * - ROLLBACK automatico ante cualquier error.
 * Garantiza atomicidad (ej.: inscripcion + sus cuotas se guardan juntas o nada).
 */
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
