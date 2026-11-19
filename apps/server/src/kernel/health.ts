import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import type { AppConfig } from './module.js';

/** What a running server knows about its own build: the commit it was built from and how many migration files ship with it. */
export interface Release {
  commit: string | null;
  expectedMigrations: number | null;
}

/** `GIT_COMMIT` is set by the deploy (the image tag, which is the git SHA unless a deploy names another tag); the migration files sit under `root` in the image. */
export function releaseFromEnv(
  env: Record<string, string | undefined>,
  root: string = process.cwd(),
): Release {
  let expectedMigrations: number | null = null;
  try {
    expectedMigrations = readdirSync(join(root, 'packages/db/migrations')).filter((name) =>
      name.endsWith('.sql'),
    ).length;
  } catch {
    // A build without the migration folder reports null rather than a wrong number.
  }
  // An image tag may be any word; only a full 40-hex git SHA is a commit worth naming.
  const tag = env.GIT_COMMIT?.trim() ?? '';
  return { commit: /^[0-9a-f]{40}$/i.test(tag) ? tag.toLowerCase() : null, expectedMigrations };
}

/** The check's answer, or undefined when it rejects or is slower than `ms`. */
async function settle<T>(check: () => Promise<T>, ms = 2000): Promise<T | undefined> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<undefined>((resolve) => {
    timer = setTimeout(() => resolve(undefined), ms);
    timer.unref();
  });
  try {
    return await Promise.race([Promise.resolve().then(check), timeout]);
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

/** True when the check resolves to something in time; a rejection or a slow answer counts as down. */
async function within(check: () => Promise<unknown>, ms = 2000): Promise<boolean> {
  return Boolean(await settle(check, ms));
}

/** Rows in the migration ledger, or null when there is no ledger or this login cannot read it. */
async function appliedMigrations(pool: Pool): Promise<number | null> {
  const has = await pool.query("SELECT to_regclass('public.schema_migration') IS NOT NULL AS yes");
  if (!has.rows[0]?.yes) return null;
  return (await pool.query('SELECT count(*)::int AS n FROM schema_migration')).rows[0].n as number;
}

export function registerHealth(app: FastifyInstance, config: AppConfig): void {
  app.get('/api/v1/health', { config: { rateLimit: false } }, async (request, reply) => {
    const [db, queue] = await Promise.all([
      within(() => config.pool.query('SELECT 1')),
      within(async () => config.jobBoss?.getQueue('sla.timer')),
    ]);
    if (db && queue) {
      // The ledger is a report, not a health condition: a database behind its code is shown, not called down.
      const applied = (await settle(() => appliedMigrations(config.pool))) ?? null;
      return {
        status: 'ok',
        commit: config.release?.commit ?? null,
        migrations: { applied, expected: config.release?.expectedMigrations ?? null },
      };
    }
    request.log.warn({ db, queue }, 'health check failed');
    return reply.code(503).send({ status: 'down', db, queue });
  });
}
