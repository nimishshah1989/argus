import { buildApp } from './app.js';
import {
  createPool,
  loggerOptions,
  publicBaseDomainFromEnv,
  rateLimitFromEnv,
  type JobRole,
} from './kernel/index.js';
import {
  startJobs,
  reconcileTicket,
  type SlaTicketReconciler,
} from './modules/accountability/index.js';
import { aiConfigFromEnv, startAiJobs } from './modules/ai/index.js';
import { parseSupportKeys } from './modules/identity/index.js';
import { startNotifyJobs, startRegisterJobs } from './modules/notifications/index.js';
import { startPmJobs } from './modules/tickets/index.js';
import { startRetentionJobs } from './retention.js';
import type { PgBoss } from 'pg-boss';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required');
// Read before anything starts: a SUPPORT_KEYS value that cannot be read stops the server, loudly.
const supportKeys = parseSupportKeys(process.env.SUPPORT_KEYS);

const pool = createPool(url);
const role = (process.env.ROLE as JobRole | undefined) ?? 'all';
const runtime: { boss?: PgBoss } = {};
const reconcileForJobs: SlaTicketReconciler = (client, tenantId, ticketId, now) =>
  reconcileTicket(client, { tenantId, ticketId, now, boss: runtime.boss });
const jobs = await startJobs({
  connectionString: url,
  pool,
  role,
  reconcileTicket: reconcileForJobs,
  onBossReady: (boss) => {
    runtime.boss = boss;
  },
});
await startAiJobs(jobs.boss, { pool, config: aiConfigFromEnv(process.env) }, role);
await startNotifyJobs(jobs.boss, { pool }, role);
await startRegisterJobs(jobs.boss, { pool }, role);
await startPmJobs(jobs.boss, { pool }, role);
await startRetentionJobs(jobs.boss, { pool }, role);

if (role === 'worker') {
  console.log('SLA worker started (no HTTP listener)');
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, async () => {
      await jobs.close();
      process.exit(0);
    });
  }
} else {
  const app = await buildApp({
    pool,
    logger: loggerOptions(),
    databaseUrl: url,
    jobBoss: jobs.boss,
    jobsHandle: jobs,
    supportKeys,
    rateLimitMax: rateLimitFromEnv(process.env),
    publicBaseDomain: publicBaseDomainFromEnv(process.env),
  });
  const port = Number(process.env.PORT ?? 3001);
  await app.listen({ port, host: '0.0.0.0' });
}
