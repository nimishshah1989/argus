import { describe, expect, it } from 'vitest';
import { loadParity, validateParity, type ParityFile } from './parity.js';

const file = loadParity();

describe('parity ledger', () => {
  it('has one unique row per parity feature', () => {
    expect(file.rows).toHaveLength(79);
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
});
