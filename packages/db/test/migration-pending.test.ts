import { execFile } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { expect, it } from 'vitest';
import { applyAppMigrations, countPendingMigrations } from '../../../scripts/migrate.js';
import { endPool } from './end-pool.js';

const run = promisify(execFile);
const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const MIGRATIONS = new URL('../migrations/', import.meta.url);
const FILES = readdirSync(MIGRATIONS)
  .filter((name) => name.endsWith('.sql'))
  .sort();

// deploy.sh takes a database snapshot only when this says something is waiting, then reads the number.
it('says how many migrations are waiting, before and after they are applied', async () => {
  const container = await new PostgreSqlContainer('postgres:16-alpine').start();
  const pool = new Pool({ connectionString: container.getConnectionUri(), max: 1 });
  const pending = async () =>
    (
      await run('pnpm', ['tsx', 'scripts/migrate.ts', '--pending'], {
        cwd: ROOT,
        env: { ...process.env, MIGRATION_DATABASE_URL: container.getConnectionUri() },
      })
    ).stdout;
  try {
    expect(await countPendingMigrations(pool, FILES)).toBe(FILES.length);
    expect(await pending()).toContain(`pending: ${FILES.length}`);

    await applyAppMigrations(pool, FILES, MIGRATIONS);
    expect(await countPendingMigrations(pool, FILES)).toBe(0);
    expect(await pending()).toContain('pending: 0');

    await pool.query('DELETE FROM schema_migration WHERE filename = $1', [FILES.at(-1)]);
    expect(await countPendingMigrations(pool, FILES)).toBe(1);
    // Counting never changes anything: the file is still waiting afterwards.
    expect(await pending()).toContain('pending: 1');
    expect(await pending()).toContain('pending: 1');
  } finally {
    await endPool(pool);
    await container.stop();
  }
}, 180_000);
