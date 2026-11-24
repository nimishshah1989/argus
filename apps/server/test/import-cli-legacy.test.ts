/**
 * Ticket 635: `pnpm import:bhavin` refuses a legacy year file (slice 69 R12 ids) before any database work and
 * points to tools/load-legacy.ts, which adds the placeholder people and the Utility failure work type first.
 * Invented ids only; no real file is read.
 */
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { LEGACY_REFUSAL, isLegacyYearFile, main } from '../src/seed/import-cli.js';

const legacyFile = {
  source: 'argus.synthetic-bhavin/v1',
  aliases: { machines: {}, people: { 'LG-00000000': 'LG-00000000' }, maintenanceCodes: {} },
  tickets: [{ legacyId: 'lg-2023-bd-HMC-2-14', ref: 'BD-30001' }],
};
const syntheticFile = {
  source: 'argus.synthetic-bhavin/v1',
  aliases: { machines: {}, people: {}, maintenanceCodes: {} },
  tickets: [{ legacyId: 'bd-0001', ref: 'BD-91001' }],
};

describe('isLegacyYearFile', () => {
  it('is true for a file whose tickets carry lg-<year>- ids', () => {
    expect(isLegacyYearFile(legacyFile)).toBe(true);
  });

  it('is true for a plant-event id (lg-<year>-uti-<date>)', () => {
    expect(isLegacyYearFile({ tickets: [{ legacyId: 'lg-2024-uti-2024-03-05' }] })).toBe(true);
  });

  it('is false for the 37c synthetic history and for non-files', () => {
    expect(isLegacyYearFile(syntheticFile)).toBe(false);
    expect(isLegacyYearFile(null)).toBe(false);
    expect(isLegacyYearFile({ tickets: [] })).toBe(false);
  });
});

describe('import:bhavin on a legacy year file', () => {
  let dir: string;
  const file = (name: string) => join(dir, name);

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'import-legacy-'));
    await writeFile(file('legacy-2023.json'), JSON.stringify(legacyFile));
    await writeFile(file('synthetic.json'), JSON.stringify(syntheticFile));
    vi.stubEnv('APP_ENV', 'staging');
    vi.stubEnv('DATABASE_URL', '');
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    await rm(dir, { recursive: true, force: true });
  });

  it('refuses with the load-legacy pointer before reading DATABASE_URL', async () => {
    await expect(main([file('legacy-2023.json'), '--tenant', 'cosmos'])).rejects.toThrow(
      LEGACY_REFUSAL,
    );
    expect(LEGACY_REFUSAL).toContain('tools/load-legacy.ts');
  });

  it('lets a non-legacy file through to the database step', async () => {
    await expect(main([file('synthetic.json'), '--tenant', 'cosmos'])).rejects.toThrow(
      'DATABASE_URL is required',
    );
  });
});
