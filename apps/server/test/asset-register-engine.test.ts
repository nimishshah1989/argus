import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_PROFILE } from '@uptimo/shared';
import {
  actionCenterBoard,
  workbookSheets,
  type EngineData,
  type ExportRow,
  type ExportSheet,
} from '@uptimo/domain';
import { withTenant } from '../src/kernel/index.js';
import { insertAssetRegister, type AssetRegisterInput } from '../src/modules/plant/index.js';
import { loadEngineData, readProfile } from '../src/modules/analytics/index.js';
import { exportDataFor } from '../src/modules/reports/export-data.js';
import { A, B, M_B, M_FREE, M_USED, startFixture, type Fixture } from './plant-settings-fixture.js';

/**
 * 51c: the register is the live source of the Action Center's AMC/legal reminders and of the workbook's AMC &
 * Warranty and Legal Compliance sheets (R12). The note convention R4 writes the type, the legal test/form and the
 * ` · not renewing` flag back; the stored end/due date wins and the tenure is 0, so the sheet's tenure columns are
 * blank and its end/due cells are the register's own dates.
 */

const AS_OF = '2026-11-11';
const DAY_MS = 86_400_000;

/** The plant date `days` after `day`, both plain dates, so no zone is involved. */
const plusDays = (day: string, days: number): string =>
  new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

const ENDS_COMPREHENSIVE = plusDays(AS_OF, 10);
const ENDS_WARRANTY = plusDays(AS_OF, 5);
const ENDS_NOT_RENEWING = plusDays(AS_OF, 5);
const ENDS_FAR = plusDays(AS_OF, 40);
const DUE_LEGAL = plusDays(AS_OF, 10);
const DUE_BLANK_LEGAL = plusDays(AS_OF, 7);

let f: Fixture;
let bRow = '';
const ids = {
  comprehensive: '',
  warranty: '',
  notRenewing: '',
  blankAmc: '',
  blankWarranty: '',
  redacted: '',
  sameTypeLater: '',
  legal: '',
  blankLegal: '',
  calibration: '',
};

/** One register row through the published 46b seam, in the plant's tenant transaction. */
async function seedRow(input: AssetRegisterInput): Promise<string> {
  return withTenant(f.db.app, A, async (tx) => (await insertAssetRegister(tx, A, input)).id);
}

/** The plant's rows and profile as the route load makes them. */
async function load(): Promise<{ data: EngineData; profile: typeof DEFAULT_PROFILE }> {
  return withTenant(f.db.app, A, async (tx) => ({
    data: await loadEngineData(tx, A),
    profile: await readProfile(tx, A),
  }));
}

const lineOf = <T extends { id: string }>(lines: readonly T[], id: string): T => {
  const found = lines.find((line) => line.id === id);
  if (!found) throw new Error(`the load holds no stack line ${id}`);
  return found;
};

const boardOf = (data: EngineData) =>
  actionCenterBoard({ data, asOf: AS_OF, profile: DEFAULT_PROFILE });

const nudgeOf = (data: EngineData, key: string) =>
  boardOf(data).nudges.find((nudge) => nudge.key === key);

const amcKey = (id: string, end: string): string => `amc|${id}|${end}`;
const legalKey = (id: string, due: string): string => `legal|${id}|${due}`;

async function sheetsOf(): Promise<ExportSheet[]> {
  const { data, profile } = await load();
  return workbookSheets(exportDataFor({ data, profile, tenant: 'plant-a', asOf: AS_OF }));
}

/** A sheet's data rows: everything after the row that carries `marker` in its last column. */
function rowsAfter(name: string, marker: string): ExportRow[] {
  const sheet = sheetsOfSync.find((candidate) => candidate.name === name);
  if (!sheet) throw new Error(`the workbook holds no sheet "${name}"`);
  const at = sheet.rows.findIndex((row) => row[row.length - 1] === marker);
  if (at < 0) throw new Error(`"${name}" has no header row ending "${marker}"`);
  return sheet.rows.slice(at + 1);
}

function amcRows(): ExportRow[] {
  return rowsAfter('AMC & Warranty', 'Not renewing');
}

function legalRows(): ExportRow[] {
  return rowsAfter('Legal Compliance', 'Certificate / report no.');
}

/** The sheets built once per suite: the export is pure and every test reads the same load. */
let sheetsOfSync: ExportSheet[] = [];

beforeAll(async () => {
  f = await startFixture();
  ids.comprehensive = await seedRow({
    kind: 'amc',
    machineId: M_USED,
    vendor: 'V-1',
    startsOn: '2026-01-01',
    endsOn: ENDS_COMPREHENSIVE,
    leadDays: 15,
    notes: 'AMC (Comprehensive)',
  });
  ids.warranty = await seedRow({
    kind: 'warranty',
    machineId: M_FREE,
    endsOn: ENDS_WARRANTY,
    leadDays: 15,
    notes: 'Mitsubishi EWC',
  });
  ids.notRenewing = await seedRow({
    kind: 'amc',
    machineId: M_FREE,
    endsOn: ENDS_NOT_RENEWING,
    leadDays: 15,
    notes: 'AMC · not renewing',
  });
  // A blank AMC note ending far out: the type falls back to the kind label, and a renewal rule keyed on
  // machine+type alone would wrongly clear the later `AMC` row below it.
  ids.blankAmc = await seedRow({
    kind: 'amc',
    machineId: M_USED,
    endsOn: ENDS_FAR,
    leadDays: 15,
  });
  // A warranty with no note and no end date: the kind's own label, and a blank end cell.
  ids.blankWarranty = await seedRow({ kind: 'warranty', machineId: M_USED, leadDays: 15 });
  ids.redacted = await seedRow({
    kind: 'amc',
    machineId: M_USED,
    endsOn: plusDays(AS_OF, 60),
    leadDays: 15,
    notes: 'Service for plant-a technician',
  });
  ids.sameTypeLater = await seedRow({
    kind: 'amc',
    machineId: M_USED,
    endsOn: plusDays(AS_OF, 9),
    leadDays: 15,
    notes: 'AMC',
  });
  ids.legal = await seedRow({
    kind: 'legal',
    machineId: M_USED,
    reference: 'CERT-9',
    startsOn: '2026-01-01',
    dueOn: DUE_LEGAL,
    leadDays: 15,
    notes: 'Test Of Pressure Vessel · Form No 11',
  });
  ids.blankLegal = await seedRow({
    kind: 'legal',
    machineId: M_USED,
    dueOn: DUE_BLANK_LEGAL,
    leadDays: 15,
  });
  ids.calibration = await seedRow({
    kind: 'calibration',
    machineId: M_FREE,
    leadDays: 15,
    notes: 'Pressure gauge calibration',
  });
  // Another plant's register row, inside the same window: it must never reach this load.
  bRow = (
    await f.admin.query(
      `INSERT INTO asset_register (tenant_id, kind, machine_id, due_on, notes)
       VALUES ($1, 'legal', $2, $3, 'their test') RETURNING id`,
      [B, M_B, DUE_LEGAL],
    )
  ).rows[0].id as string;
  sheetsOfSync = await sheetsOf();
}, 180_000);

afterAll(() => f.stop());

describe('the register as EngineData.amc/legal', () => {
  it('maps every R12 field: the note text back, months 0, the stored dates and the row id', async () => {
    const { data } = await load();
    const amc = data.amc ?? [];
    expect(lineOf(amc, ids.comprehensive)).toEqual({
      id: ids.comprehensive,
      machineId: M_USED,
      type: 'AMC (Comprehensive)',
      start: '2026-01-01',
      months: 0,
      vendor: 'V-1',
      noRenew: false,
      endsOn: ENDS_COMPREHENSIVE,
      itemKey: ids.comprehensive,
    });
    expect(lineOf(amc, ids.warranty)).toMatchObject({
      type: 'Mitsubishi EWC',
      months: 0,
      noRenew: false,
      endsOn: ENDS_WARRANTY,
      itemKey: ids.warranty,
    });
    expect(lineOf(amc, ids.notRenewing)).toMatchObject({
      type: 'AMC',
      noRenew: true,
      endsOn: ENDS_NOT_RENEWING,
    });
    expect(lineOf(amc, ids.sameTypeLater).type).toBe('AMC');

    const blankLegal = lineOf(data.legal ?? [], ids.blankLegal);
    expect(blankLegal).toEqual({
      id: ids.blankLegal,
      machineId: M_USED,
      tid: ids.blankLegal,
      name: '',
      form: null,
      last: null,
      months: 0,
      cert: null,
      dueOn: DUE_BLANK_LEGAL,
      itemKey: ids.blankLegal,
    });
    expect(lineOf(data.legal ?? [], ids.legal)).toEqual({
      id: ids.legal,
      machineId: M_USED,
      tid: ids.legal,
      name: 'Test Of Pressure Vessel',
      form: 'Form No 11',
      last: '2026-01-01',
      months: 0,
      cert: 'CERT-9',
      dueOn: DUE_LEGAL,
      itemKey: ids.legal,
    });
    // Calibration rows are the same register and arrive on the legal side.
    expect(lineOf(data.legal ?? [], ids.calibration)).toMatchObject({
      name: 'Pressure gauge calibration',
      dueOn: undefined,
    });
    // Another plant's row is not in this load.
    expect((data.legal ?? []).some((line) => line.id === bRow)).toBe(false);
  });

  it('falls back to the kind label on an empty note, and the redactor replaces a name in one', async () => {
    const { data } = await load();
    const amc = data.amc ?? [];
    expect(lineOf(amc, ids.blankAmc).type).toBe('AMC');
    expect(lineOf(amc, ids.blankWarranty).type).toBe('Warranty');
    const redacted = lineOf(amc, ids.redacted).type;
    expect(redacted).toMatch(/^Service for \[P\d+\]$/);
    expect(JSON.stringify(data)).not.toContain('plant-a technician');
  });

  it('keeps a row with no end or due date blank rather than inventing one', async () => {
    const { data } = await load();
    expect(lineOf(data.amc ?? [], ids.blankWarranty).endsOn).toBeUndefined();
    expect(lineOf(data.legal ?? [], ids.calibration).dueOn).toBeUndefined();
  });
});

/** A nudge names its machine by id and prints its code: the fixture's two machines are VC-01 and VC-02. */
const CODE_FREE = 'VC-01';
const CODE_USED = 'VC-02';

describe('the Action Center’s AMC and legal nudges', () => {
  it('raises the register’s AMC, warranty and legal reminders with their own words', async () => {
    const { data } = await load();
    expect(nudgeOf(data, amcKey(ids.comprehensive, ENDS_COMPREHENSIVE))).toMatchObject({
      rule: 'amc',
      title: `${CODE_USED}: AMC (Comprehensive) ends in 10 days`,
      machines: [M_USED],
    });
    expect(nudgeOf(data, amcKey(ids.warranty, ENDS_WARRANTY))).toMatchObject({
      rule: 'amc',
      sev: 'high',
      title: `${CODE_FREE}: Mitsubishi EWC ends in 5 days`,
    });
    expect(nudgeOf(data, legalKey(ids.legal, DUE_LEGAL))).toMatchObject({
      rule: 'legal',
      title: `${CODE_USED}: Test Of Pressure Vessel (Form Form No 11) due in 10 days`,
    });
    expect(nudgeOf(data, legalKey(ids.blankLegal, DUE_BLANK_LEGAL))).toMatchObject({
      rule: 'legal',
      title: `${CODE_USED}: Legal compliance due in 7 days`,
    });
  });

  it('never nudges a not-renewing row, and both legal rows of one machine nudge', async () => {
    const { data } = await load();
    const board = boardOf(data);
    expect(board.nudges.some((nudge) => nudge.key.startsWith(`amc|${ids.notRenewing}|`))).toBe(
      false,
    );
    const legal = board.nudges.filter((nudge) => nudge.rule === 'legal');
    expect(legal.map((nudge) => nudge.key)).toEqual(
      expect.arrayContaining([
        legalKey(ids.legal, DUE_LEGAL),
        legalKey(ids.blankLegal, DUE_BLANK_LEGAL),
      ]),
    );
  });

  it('makes the row id the item identity: a later same-type row cannot clear an earlier one', async () => {
    const { data } = await load();
    expect(nudgeOf(data, amcKey(ids.sameTypeLater, plusDays(AS_OF, 9)))).toMatchObject({
      title: `${CODE_USED}: AMC ends in 9 days`,
    });
  });

  it('an ack on the register key closes the nudge in the open list', async () => {
    const key = amcKey(ids.comprehensive, ENDS_COMPREHENSIVE);
    await f.admin.query('INSERT INTO setting (tenant_id, key, value) VALUES ($1, $2, $3::jsonb)', [
      A,
      `nudge:${key}`,
      JSON.stringify({ status: 'ack', owner: '', due: '', note: '', at: '2026-11-01T00:00:00Z' }),
    ]);
    try {
      const { data } = await load();
      const board = boardOf(data);
      expect(board.nudges.find((nudge) => nudge.key === key)).toMatchObject({ status: 'ack' });
      const open = board.nudges.filter((nudge) => nudge.status === 'open');
      expect(open.map((nudge) => nudge.key)).not.toContain(key);
    } finally {
      await f.admin.query('DELETE FROM setting WHERE tenant_id = $1 AND key = $2', [
        A,
        `nudge:${key}`,
      ]);
    }
  });
});

// The sheets print the machine's code, never its id (the fixture's two machines are VC-01 and VC-02).
const CODE_FREE = 'VC-01';
const CODE_USED = 'VC-02';

describe('the workbook’s two register sheets', () => {
  it('prints the AMC type, start, stored end and the not-renewing cell', async () => {
    const comprehensive = amcRows().find(
      (row) => row[1] === CODE_USED && row[2] === 'AMC (Comprehensive)',
    );
    expect(comprehensive).toBeDefined();
    expect(comprehensive!.slice(1)).toEqual([
      CODE_USED,
      'AMC (Comprehensive)',
      '2026-01-01',
      '',
      '21-11-2026',
      'V-1',
      '',
    ]);
    const notRenewing = amcRows().find((row) => row[2] === 'AMC' && row[7] === 'yes');
    expect(notRenewing).toBeDefined();
    expect(notRenewing!.slice(1, 8)).toEqual([CODE_FREE, 'AMC', '', '', '16-11-2026', '', 'yes']);
    const warranty = amcRows().find((row) => row[2] === 'Mitsubishi EWC');
    expect(warranty!.slice(3, 7)).toEqual(['', '', '16-11-2026', '']);
  });

  it('prints the legal test, form, last date, stored due and the certificate', async () => {
    const legal = legalRows().find((row) => row[2] === 'Test Of Pressure Vessel');
    expect(legal).toBeDefined();
    expect(legal!.slice(1)).toEqual([
      CODE_USED,
      'Test Of Pressure Vessel',
      'Form No 11',
      '2026-01-01',
      '',
      '2026-11-21',
      'CERT-9',
    ]);
    const blank = legalRows().find((row) => row[1] === CODE_USED && row[6] === DUE_BLANK_LEGAL);
    expect(blank!.slice(1)).toEqual([CODE_USED, '', '', '', '', DUE_BLANK_LEGAL, '']);
  });

  it('leaves the end/due cells blank when the register has no date', async () => {
    const noEnd = amcRows().find((row) => row[1] === CODE_USED && row[2] === 'Warranty');
    expect(noEnd).toBeDefined();
    expect(noEnd!.slice(1)).toEqual([CODE_USED, 'Warranty', '', '', '', '', '']);
    const noDue = legalRows().find((row) => row[2] === 'Pressure gauge calibration');
    expect(noDue).toBeDefined();
    expect(noDue!.slice(1)).toEqual([CODE_FREE, 'Pressure gauge calibration', '', '', '', '', '']);
  });

  it('a removed register row leaves the load, the board and both sheets', async () => {
    await f.admin.query('DELETE FROM asset_register WHERE tenant_id = $1 AND id = $2', [
      A,
      ids.comprehensive,
    ]);
    const { data } = await load();
    expect((data.amc ?? []).some((line) => line.id === ids.comprehensive)).toBe(false);
    expect(nudgeOf(data, amcKey(ids.comprehensive, ENDS_COMPREHENSIVE))).toBeUndefined();
    sheetsOfSync = await sheetsOf();
    expect(amcRows().some((row) => row[2] === 'AMC (Comprehensive)')).toBe(false);
  });
});
