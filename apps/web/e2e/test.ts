import { expect, test as base } from '@playwright/test';
import { Pool } from 'pg';
import { TENANT_WEB_URL, seedStatements } from './fixtures.js';

/** Seeds this worker's own tenant (e2e-w<n>) into the run's database. */
async function seedWorkerTenant(): Promise<void> {
  const connectionString = process.env.E2E_ADMIN_DATABASE_URL;
  const hash = process.env.E2E_PASSWORD_HASH;
  if (!connectionString || !hash) throw new Error('e2e: global setup did not publish the database');
  const pool = new Pool({ connectionString, max: 1 });
  try {
    for (const statement of seedStatements(hash))
      await pool.query(statement.text, statement.values);
  } finally {
    await pool.end();
  }
}

export const test = base.extend<object, { workerTenant: void }>({
  workerTenant: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      await seedWorkerTenant();
      await use();
    },
    { scope: 'worker', auto: true },
  ],
  // eslint-disable-next-line no-empty-pattern
  baseURL: async ({}, use) => {
    await use(TENANT_WEB_URL);
  },
});

export { expect };
