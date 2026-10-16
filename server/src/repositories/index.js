import { createMemoryRepositories } from './memory.js';

// Titik tukar penyimpanan. Tahap ini hanya punya adapter memori (sementara,
// hilang saat restart). Adapter PostgreSQL ditambahkan di sini pada tahap
// berikutnya tanpa mengubah routes maupun service.
const repositories = createMemoryRepositories();

export const { users, refreshTokens, documents, analyses, issues, payments } = repositories;
export default repositories;
