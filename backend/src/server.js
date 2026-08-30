import 'dotenv/config';
import app from './app.js';
import { pool } from './config/db.js';

const PORT = process.env.PORT || 4000;

const server = app.listen(PORT, () => {
  console.log(`[OK] API escuchando en http://localhost:${PORT}`);
});

/* Cierre ordenado: SIGINT/SIGTERM liberan el pool de conexiones antes de salir */
['SIGINT', 'SIGTERM'].forEach((signal) => {
  process.on(signal, () => {
    console.log(`\n${signal} recibido: cerrando servidor...`);
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  });
});
