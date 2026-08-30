import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { pool } from '../config/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Crea (o recrea) las tablas ejecutando sql/schema.sql.
 * Uso: npm run db:init
 */
try {
  const sqlPath = path.join(__dirname, '..', '..', 'sql', 'schema.sql');
  const sql = await readFile(sqlPath, 'utf8');
  await pool.query(sql);
  console.log('[OK] Esquema de base de datos aplicado correctamente.');
} catch (err) {
  console.error('[ERROR] No se pudo aplicar el esquema:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
