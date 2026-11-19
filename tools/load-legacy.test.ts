import { describe, expect, it } from 'vitest';
import { main } from './load-legacy.js';

const real = process.env.LEGACY_DATA_DIR;
const database = process.env.DATABASE_URL;
const tenant = process.env.LEGACY_TENANT;

describe('load:legacy command', () => {
  it('asks for the tenant and the data folder before it reads or writes anything', async () => {
    await expect(main(['--data', 'somewhere'])).rejects.toThrow(/usage/);
    const before = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    try {
      await expect(main(['--data', 'somewhere', '--tenant', 'x'])).rejects.toThrow(/DATABASE_URL/);
      await expect(main(['--tenant', 'x'])).rejects.toThrow(/usage/);
    } finally {
      if (before !== undefined) process.env.DATABASE_URL = before;
    }
  });

  it('refuses an option it does not know', async () => {
    await expect(main(['--tenant', 'x', '--out', 'y'])).rejects.toThrow(/unknown option --out/);
  });

  // The real workbooks never sit in the repository or in CI: LEGACY_DATA_DIR, DATABASE_URL (a local, migrated and
  // seeded database) and LEGACY_TENANT turn this on. It prints counts and codes only and loads four batches.
  it.skipIf(!real || !database || !tenant)(
    'real workbooks: four batches load done and no more than 229 differing summary machine-months are left without a cause',
    async () => {
      process.exitCode = undefined;
      const result = await main(['--data', real ?? '', '--tenant', tenant ?? '']);
      expect(result.loaded.map((l) => l.status)).toEqual(['done', 'done', 'done', 'done']);
      // Goal 5 is not met yet: 229 machine-months have no explained cause (docs/plan/evidence/69c-real-load.md, Bhavin's
      // questions). This ceiling fails if the cause analysis regresses; lower it as the questions are answered.
      expect(result.unexplained).toBeLessThanOrEqual(229);
      expect(process.exitCode).toBeUndefined();
    },
    3_600_000,
  );
});
