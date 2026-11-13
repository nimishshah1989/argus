import { PgBoss, type Clock, type Queue } from 'pg-boss';
import type { Pool } from 'pg';
import { processSlaTimerJob, type SlaTimerPayload } from './sla-timer.js';
import {
  processSlaConsistencyJob,
  type SlaConsistencyPayload,
  type SlaTicketReconciler,
} from './sla-consistency.js';
import type { JobRole, JobsHandle } from '../kernel/index.js';

export type { JobRole, JobsHandle };

export interface StartJobsOptions {
  connectionString: string;
  pool: Pool;
  reconcileTicket: SlaTicketReconciler;
  role?: JobRole;
  clock?: Clock;
  now?: () => Date;
  pollingIntervalSeconds?: number;
  dailyConsistency?: boolean;
  bootConsistency?: boolean;
  onBossReady?: (boss: PgBoss) => void | Promise<void>;
  __test__enableSpies?: boolean;
  onError?: (error: Error) => void;
}

async function ensureQueue(
  boss: PgBoss,
  name: string,
  options: Omit<Queue, 'name'>,
): Promise<void> {
  if (!(await boss.getQueue(name))) await boss.createQueue(name, options);
}

async function registerWorkers(boss: PgBoss, options: StartJobsOptions): Promise<void> {
  const now = options.now ?? (() => new Date(options.clock?.now() ?? Date.now()));
  const pollingIntervalSeconds = options.pollingIntervalSeconds ?? 2;
  await boss.work<SlaTimerPayload>(
    'sla.timer',
    { batchSize: 1, pollingIntervalSeconds },
    async ([job]) => {
      if (!job) return false;
      return processSlaTimerJob(job.data, { pool: options.pool, now, boss });
    },
  );
  await boss.work<SlaConsistencyPayload>(
    'sla.consistency',
    { batchSize: 1, pollingIntervalSeconds },
    async ([job]) => {
      if (!job) return { tenants: 0, tickets: 0 };
      return processSlaConsistencyJob(job.data, {
        pool: options.pool,
        reconcileTicket: options.reconcileTicket,
        now,
      });
    },
  );
}

export async function startJobs(options: StartJobsOptions): Promise<JobsHandle> {
  const role = options.role ?? (process.env.ROLE as JobRole | undefined) ?? 'all';
  if (!['all', 'api', 'worker'].includes(role)) throw new Error(`Invalid ROLE: ${role}`);
  const boss = new PgBoss({
    connectionString: options.connectionString,
    schema: 'pgboss',
    migrate: false,
    clock: options.clock,
    __test__enableSpies: options.__test__enableSpies,
    openTelemetry: { enabled: false },
  });
  boss.on('error', options.onError ?? console.error);
  await boss.start();
  await options.onBossReady?.(boss);
  try {
    await ensureQueue(boss, 'sla.timer', {
      policy: 'standard',
      retryLimit: 2,
      retryDelay: 1,
      expireInSeconds: 60,
    });
    await ensureQueue(boss, 'sla.consistency', {
      policy: 'standard',
      retryLimit: 2,
      retryDelay: 5,
      expireInSeconds: 900,
    });
    if (role !== 'api') {
      await registerWorkers(boss, options);
      if (options.dailyConsistency ?? true) {
        await boss.schedule(
          'sla.consistency',
          '0 4 * * *',
          {},
          {
            key: 'all',
            tz: 'UTC',
            missed: 'once',
            singletonKey: 'all',
          },
        );
      }
      if (options.bootConsistency ?? true) {
        await boss.upsert({ name: 'sla.consistency', data: {}, options: { singletonKey: 'all' } });
      }
    }
  } catch (error) {
    await boss.stop();
    throw error;
  }
  let closed = false;
  return {
    boss,
    close: async () => {
      if (closed) return;
      closed = true;
      await boss.stop();
    },
  };
}

export { rearmTicket, processSlaTimerJob } from './sla-timer.js';
export { runSlaConsistency, processSlaConsistencyJob } from './sla-consistency.js';
