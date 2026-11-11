import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadParity, parseImportSourceRow, validateParity, type ParityFile } from './parity.js';
import { syncImportRow } from './sync-parity.js';

const file = loadParity();

describe('parity ledger', () => {
  it('has one unique row per parity feature', () => {
    expect(file.rows).toHaveLength(file.expected_rows ?? file.rows.length);
    expect(new Set(file.rows.map((row) => row.id)).size).toBe(file.rows.length);
  });

  it('passes the schema', () => {
    expect(validateParity(file)).toEqual([]);
  });

  it('rejects a waived row with no reason', () => {
    const broken: ParityFile = {
      version: 1,
      rows: [
        {
          id: 'v3.test.02',
          feature: 'x',
          disposition: 'drop',
          milestone: 'M1',
          status: 'waived',
          evidence: [],
        },
      ],
    };
    expect(validateParity(broken)).toContain('v3.test.02: waived without a reason');
  });

  it('rejects an external row with no reason', () => {
    const broken: ParityFile = {
      version: 1,
      rows: [
        {
          id: 'v3.test.03',
          feature: 'x',
          disposition: 'keep',
          milestone: 'M1',
          status: 'external',
          evidence: [],
        },
      ],
    };
    expect(validateParity(broken)).toContain('v3.test.03: external without a reason');
  });

  it('rejects a done row with no evidence', () => {
    const broken: ParityFile = {
      version: 1,
      rows: [
        {
          id: 'v3.test.01',
          feature: 'x',
          disposition: 'keep',
          milestone: 'M1',
          status: 'done',
          evidence: [],
        },
      ],
    };
    expect(validateParity(broken)).toContain('v3.test.01: done without evidence');
  });

  it('T48 regenerates the import row from PARITY.md with honest synthetic evidence', () => {
    const markdown = readFileSync('docs/spec/PARITY.md', 'utf8');
    const source = parseImportSourceRow(markdown);
    const synced = syncImportRow(file, source);
    const row = synced.rows.find((candidate) => candidate.id === 'v3.import.01');
    expect(row).toMatchObject({
      feature: source.feature,
      disposition: source.disposition,
      milestone: source.milestone,
      status: 'in-progress',
    });
    expect(synced.expected_rows).toBe(synced.rows.length);
    expect(row?.evidence.join('\n')).not.toContain('PR #68');
    expect(row?.evidence.join('\n')).toContain('import-cli.test.ts');
    expect(row?.external_reason).toContain('Real N1');
    expect(validateParity(synced, markdown)).toEqual([]);
  });

  it('T48 rejects a ledger row that disagrees with its PARITY.md source', () => {
    const markdown = readFileSync('docs/spec/PARITY.md', 'utf8');
    const broken = {
      ...file,
      rows: file.rows.map((row) =>
        row.id === 'v3.import.01' ? { ...row, feature: 'invented source feature' } : row,
      ),
    };
    expect(validateParity(broken, markdown)).toContain(
      'v3.import.01: feature does not match PARITY.md source',
    );
  });
});
