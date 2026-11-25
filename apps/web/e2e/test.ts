import { expect, test as base } from '@playwright/test';
import { Pool } from 'pg';
import { en, gu, type MessageKey } from '@uptimo/shared/i18n';
import { TENANT_WEB_URL, seedStatements } from './fixtures.js';
import { actionSeedStatements } from './fixtures-actions.js';
import { signoffSeedStatements } from './fixtures-signoff.js';
import { pmSeedStatements } from './fixtures-pm.js';
import { pmCalendarSeedStatements } from './fixtures-pm-calendar.js';

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
      ...pmSeedStatements(),
      ...pmCalendarSeedStatements(),
    ])
      await pool.query(statement.text, statement.values);
  } finally {
    await pool.end();
  }
}

export type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;

/** The phone switch the app reads once at load for `GUJARATI_ON` (apps/web/src/i18n/index.ts, ADR 0038). */
const GUJARATI_SWITCH = 'uptimo.gujarati';

export const test = base.extend<
  { t: Translate; gujaratiOn: boolean },
  { workerTenant: void; uiLanguage: 'en' | 'gu' }
>({
  /** A catalogue string in the tenant language, English where gu is empty (as the app does). */
  t: async ({ uiLanguage }, use) => {
    const catalogue: Record<string, string> = uiLanguage === 'gu' ? gu : en;
    await use((key, vars = {}) =>
      (catalogue[key] || en[key]).replace(/\{\{(\w+)\}\}/g, (_, name: string) =>
        String(vars[name]),
      ),
    );
  },
  /** Gujarati is hidden unless switched on (ADR 0036 R25); the `gujarati` project and the Gujarati specs switch it on. */
  gujaratiOn: [false, { option: true }],
  page: async ({ page, gujaratiOn }, use) => {
    if (gujaratiOn)
      await page.addInitScript((key) => localStorage.setItem(key, 'on'), GUJARATI_SWITCH);
    await use(page);
  },
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
