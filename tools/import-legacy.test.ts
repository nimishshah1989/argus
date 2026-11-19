import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SWITCHES } from '../apps/server/src/seed/legacy-classify.js';
import { convertLegacy } from '../apps/server/src/seed/legacy-export.js';
import {
  assertOutsideRepo,
  findWorkbooks,
  loadPlant,
  parseArgs,
  parseSwitches,
  readAll,
} from './import-legacy.js';

const real = process.env.LEGACY_DATA_DIR;

describe('import:legacy command', () => {
  it("defaults to Bhavin's 19 Nov answers and turns each switch", () => {
    expect(parseSwitches(new Map())).toEqual(DEFAULT_SWITCHES);
    const on = parseSwitches(
      parseArgs(['--star', 'off', '--retired', 'keep', '--gap', 'none', '--fold', 'none']),
    );
    expect(on).toEqual({ star: {}, retired: 'keep', gap: [], fold: {} });
    expect(parseSwitches(parseArgs(['--gap', '2022-02', '--fold', 'ele=e'])).fold).toEqual({
      ELE: 'E',
    });
    expect(() => parseSwitches(new Map([['retired', 'maybe']]))).toThrow(/drop or keep/);
    expect(() => parseArgs(['--data'])).toThrow(/usage/);
  });

  it('refuses an output folder inside the repository and accepts one outside', () => {
    expect(() => assertOutsideRepo('out')).toThrow(/outside any git checkout/);
    expect(() => assertOutsideRepo('tools/x')).toThrow(/outside any git checkout/);
    expect(() => assertOutsideRepo('tools/..private/out')).toThrow(/outside any git checkout/);
    const link = join(mkdtempSync(join(tmpdir(), 'legacy-link-')), 'into-repo');
    symlinkSync(join(process.cwd(), 'tools'), link);
    expect(() => assertOutsideRepo(join(link, 'new-out'))).toThrow(/outside any git checkout/);
    expect(() => assertOutsideRepo(join(tmpdir(), 'legacy-out'))).not.toThrow();
  });

  it('refuses an output folder inside any other git checkout, such as the main checkout of a worktree', () => {
    const checkout = mkdtempSync(join(tmpdir(), 'legacy-checkout-'));
    writeFileSync(join(checkout, '.git'), 'gitdir: elsewhere');
    expect(() => assertOutsideRepo(join(checkout, 'deep', 'out'))).toThrow(
      /outside any git checkout/,
    );
  });

  it('rejects a bad --gap month, an unknown option, and a plant file missing machines or terms', () => {
    expect(() => parseSwitches(new Map([['gap', '2022-2']]))).toThrow(/YYYY-MM/);
    expect(() => parseSwitches(new Map([['gap', '2022-13']]))).toThrow(/YYYY-MM/);
    expect(parseSwitches(new Map([['gap', '2022-02, 2022-04']])).gap).toEqual([
      '2022-02',
      '2022-04',
    ]);
    expect(() => parseArgs(['--retierd', 'keep'])).toThrow(/unknown option/);
    const dir = mkdtempSync(join(tmpdir(), 'legacy-plant-'));
    const write = (name: string, body: unknown) => {
      writeFileSync(join(dir, name), JSON.stringify(body));
      return join(dir, name);
    };
    expect(() => loadPlant(write('a.json', { machines: ['ZZ-1'] }))).toThrow(/"terms"/);
    expect(() => loadPlant(write('b.json', { terms: [] }))).toThrow(/"machines"/);
    expect(loadPlant(write('c.json', { machines: ['ZZ-1'], terms: ['x'] })).terms).toEqual(['x']);
  });

  it('finds workbooks by the year in their name and skips hidden files, __MACOSX and nameless years', () => {
    const dir = mkdtempSync(join(tmpdir(), 'legacy-find-'));
    mkdirSync(join(dir, 'a'));
    mkdirSync(join(dir, '__MACOSX'));
    for (const name of [
      'a/VTL-2023.xlsx',
      'a/HMC-2022.xlsx',
      'a/Jul-23.xlsx',
      'a/.hidden-2022.xlsx',
      'a/~$VTL-2023.xlsx',
      '__MACOSX/X-2022.xlsx',
      'a/notes-2022.txt',
    ]) {
      writeFileSync(join(dir, name), '');
    }
    expect(findWorkbooks(dir).map((w) => [w.year, w.path.slice(dir.length)])).toEqual([
      [2022, '/a/HMC-2022.xlsx'],
      [2023, '/a/VTL-2023.xlsx'],
    ]);
  });

  it.skipIf(!real)(
    'real workbooks: rows read per year, the file cap and the identity',
    () => {
      const plant = loadPlant(undefined);
      const { rows } = readAll(real ?? '', plant.machines);
      const { files, reports } = convertLegacy(rows, plant, DEFAULT_SWITCHES);
      expect(reports.map((r) => r.measured.withDate)).toEqual([1098, 3078, 2327, 1329]);
      expect(reports.map((r) => r.identity)).toEqual([true, true, true, true]);
      for (const file of files) expect(file.tickets + file.events).toBeLessThanOrEqual(2000);
    },
    300_000,
  );
});
