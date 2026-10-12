import 'dotenv/config';
import { migrateTest } from '../test/migrateTest.js';
import { seedDev } from './migrate.js';
import { createApp } from './app.js';
import { config } from './config.js';

// Mode demo lokal: skema in-memory + seed otomatis, lalu start API.
// Dipakai untuk "coba lihat webnya" tanpa PostgreSQL.
// Data SEMENTARA — hilang saat server dimatikan.
try {
  await migrateTest();
  await seedDev();
} catch (err) {
  console.error('[demo] migrasi/seed gagal:', err.message);
  process.exit(1);
}
const app = createApp();
app.listen(config.port, () => console.log(`[runut] API demo di http://localhost:${config.port} (data sementara, in-memory)`));
