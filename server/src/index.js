import { start } from './app.js';

start().catch((err) => {
  console.error('[runut] gagal memulai server:', err);
  process.exit(1);
});
