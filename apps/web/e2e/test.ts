import { expect, test as base } from '@playwright/test';
import { Pool } from 'pg';
import { TENANT_WEB_URL, seedStatements } from './fixtures.js';
import { actionSeedStatements } from './fixtures-actions.js';
import { signoffSeedStatements } from './fixtures-signoff.js';

/** Seeds this worker's own tenant (e2e-w<n>) into the run's database. */
async function seedWorkerTenant(language: 'en' | 'gu'): Promise<void> {
  const connectionString = process.env.E2E_ADMIN_DATABASE_URL;
  const hash = process.env.E2E_PASSWORD_HASH;
  if (!connectionString || !hash) throw new Error('e2e: global setup did not publish the database');
  const pool = new Pool({ connectionString, max: 1 });
  try {
    for (const statement of [
      ...seedStatements(hash, language),
      ...actionSeedStatements(hash),
      ...signoffSeedStatements(),
    ])
      await pool.query(statement.text, statement.values);
  } finally {
    await pool.end();
  }
}

export const test = base.extend<object, { workerTenant: void; uiLanguage: 'en' | 'gu' }>({
  /** The tenant language this worker is seeded with; the `gujarati` project sets `gu`. */
  uiLanguage: ['en', { scope: 'worker', option: true }],
  workerTenant: [
    async ({ uiLanguage }, use) => {
      await seedWorkerTenant(uiLanguage);
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
