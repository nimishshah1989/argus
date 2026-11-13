import { readdirSync, readFileSync } from 'node:fs';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Client, Pool } from 'pg';
import { installJobSchema } from '../src/install-jobs.js';

const MIGRATIONS = new URL('../migrations/', import.meta.url);

/** A postgres:16-alpine container with the migrations applied raw as the superuser, then the job schema and seed. */
export async function startMigratedDb(
  options: { through?: string; seed?: boolean } = {},
): Promise<{ container: StartedPostgreSqlContainer; client: Client; url: string }> {
  const container = await new PostgreSqlContainer('postgres:16-alpine').start();
  const url = container.getConnectionUri();
  const client = new Client({ connectionString: url });
  await client.connect();
  for (const file of readdirSync(MIGRATIONS)
    .filter((name) => name.endsWith('.sql') && name <= (options.through ?? '￿'))
    .sort()) {
    await client.query(readFileSync(new URL(file, MIGRATIONS), 'utf8'));
  }
  const installerPool = new Pool({ connectionString: url, max: 1 });
  await installJobSchema(installerPool);
  await installerPool.end();
  if (options.seed ?? true) {
    await client.query(readFileSync(new URL('./seed.sql', import.meta.url), 'utf8'));
  }
  return { container, client, url };
}
