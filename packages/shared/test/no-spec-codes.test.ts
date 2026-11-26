import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const folder = new URL('../src/i18n/', import.meta.url);
const files = readdirSync(folder).filter((name) => /\.(en|gu)\.ts$/.test(name));

/** Nimish, 26 Nov: screens carry plain names, never the old spec codes ("A3 MTTR and MTBF" is "MTTR and MTBF"). */
describe('no catalogue value starts with an A-code', () => {
  it('checks every en and gu catalogue, Latin and Gujarati digits', async () => {
    expect(files.length).toBeGreaterThan(10);
    const offenders: string[] = [];
    for (const name of files) {
      const module = (await import(new URL(name, folder).href)) as Record<string, unknown>;
      for (const catalogue of Object.values(module)) {
        if (typeof catalogue !== 'object' || catalogue === null) continue;
        for (const [key, value] of Object.entries(catalogue)) {
          if (typeof value === 'string' && /^A[0-9૦-૯]+ /.test(value))
            offenders.push(`${name} ${key}: ${value}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
