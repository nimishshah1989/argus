import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  keptScreens,
  loadParity,
  parseImportSourceRow,
  validateParity,
  type ParityFile,
  type ParityRow,
} from './parity.js';
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

  it('rejects an in-progress row with neither evidence nor a ticket', () => {
    const row = {
      id: 'v3.test.04',
      feature: 'x',
      disposition: 'keep' as const,
      milestone: 'M1',
      status: 'in-progress' as const,
      evidence: [],
    };
    expect(validateParity({ version: 1, rows: [row] })).toContain(
      'v3.test.04: in-progress without evidence or a ticket',
    );
    const ticketed = validateParity({ version: 1, rows: [{ ...row, ticket: '#91' }] });
    expect(ticketed.filter((error) => error.startsWith('v3.test.04'))).toEqual([]);
  });
});

const TRIAGE = [
  '| id | Screen | Verdict | Ticket | Key | Reason | Cost if wrong |',
  '| -- | ------ | ------- | ------ | --- | ------ | ------------- |',
  '| a1-bd-pm | A1 BD % | KEPT | 40 | a1-bd-pm | headline | - |',
  '| pdf-import | PDF import | DROPPED | 36 | - | tickets make reports | re-key by hand |',
].join('\n');

const screenRow = (over: Partial<ParityRow> = {}): ParityRow => ({
  id: 'm4a.a1-bd-pm',
  feature: 'A1 BD % and PM split',
  disposition: 'keep',
  milestone: 'M4a',
  status: 'todo',
  evidence: [],
  screen: 'a1-bd-pm',
  ticket: '40',
  ...over,
});

const problems = (rows: ParityRow[]): string[] =>
  validateParity({ version: 1, rows }, undefined, TRIAGE).filter((e) => e.includes('a1-bd-pm'));

describe('kept screens need a row and a ticket (ticket 36)', () => {
  it('reads the kept screens, and only those, from the triage table', () => {
    expect(keptScreens(TRIAGE)).toEqual([{ id: 'a1-bd-pm', ticket: '40' }]);
  });

  it('fails a kept screen that has no parity row', () => {
    expect(problems([])).toContain('screen a1-bd-pm: kept in the M4a triage but has no parity row');
  });

  it('fails a kept screen whose row names no ticket', () => {
    expect(problems([screenRow({ ticket: undefined })])).toContain(
      'screen a1-bd-pm: row m4a.a1-bd-pm has no ticket',
    );
  });

  it('fails a row whose ticket is not the one the triage names', () => {
    expect(problems([screenRow({ ticket: '41' })])).toContain(
      'screen a1-bd-pm: row m4a.a1-bd-pm names ticket 41 but the triage names 40',
    );
  });

  it('fails a screen tracked by two rows, so a ticket cannot hide behind the first match', () => {
    const rows = [screenRow(), screenRow({ id: 'm4a.a1-bd-pm-again', ticket: '41' })];
    expect(problems(rows)).toContain(
      'screen a1-bd-pm: 2 rows track it (m4a.a1-bd-pm, m4a.a1-bd-pm-again); keep one',
    );
  });

  it('passes a kept screen with its row and ticket, and does not ask for a dropped one', () => {
    expect(problems([screenRow()])).toEqual([]);
  });

  it('fails a row that keeps claiming work for a dropped screen', () => {
    const row = screenRow({
      id: 'm4a.pdf-import',
      feature: 'PDF import by QR',
      disposition: 'keep',
      screen: 'pdf-import',
      ticket: '36',
    });
    expect(validateParity({ version: 1, rows: [row] }, undefined, TRIAGE)).toContain(
      'screen pdf-import: dropped in the M4a triage but row m4a.pdf-import still claims work (todo, keep)',
    );
  });

  it('passes a dropped screen that is waived off with its reason', () => {
    const row = screenRow({
      id: 'm4a.pdf-import',
      feature: 'PDF import by QR',
      disposition: 'drop',
      screen: 'pdf-import',
      status: 'waived',
      waiver_reason: 'tickets create the report',
      ticket: '36',
    });
    expect(
      validateParity({ version: 1, rows: [row] }, undefined, TRIAGE).filter((error) =>
        error.startsWith('screen pdf-import'),
      ),
    ).toEqual([]);
  });

  it('holds on the real ledger and the real triage', () => {
    expect(validateParity(file).filter((e) => e.startsWith('screen '))).toEqual([]);
    expect(keptScreens(readFileSync('docs/plan/m4a-triage.md', 'utf8')).length).toBeGreaterThan(25);
  });
});
