import { buildApp } from './app.js';
import { createPool } from './db.js';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required');

const app = await buildApp({ pool: createPool(url), logger: true });
const port = Number(process.env.PORT ?? 3001);
await app.listen({ port, host: '0.0.0.0' });
