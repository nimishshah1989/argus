import { describe, expect, it } from 'vitest';
import { workbookSheets, type ExportData, type ExportRow, type ExportSheet } from '../src/index.js';
import { ENGINE_DATA } from './answer-key/fixture.js';
import { EXPORT_DATA, WORKBOOK_KEY } from './answer-key/workbook-export.js';
import { isUuid, originalIds, rekeyToUuids, uuidFor } from './answer-key/rekey.js';

/**
 * The plant's Excel workbook is opened by heads and Bhavin. On a real plant every machine, ticket, report and move
 * id is a UUID and the fixture's ids equal their codes, so this runs every sheet over the answer-key plant with all
 * of them re-keyed to UUIDs (codes untouched) and fails on a UUID in any cell a person reads. The one thing it lets
 * through is a column that says it is an id.
 */

const UUID_IN_TEXT = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;

interface Deliberate {
  sheet: string;
  column: string;
  why: string;
}

/**
 * Nothing reads these columns back: the importers read Bhavin's JSON, never a workbook (slice 45, open question 4: the
 * export is not a restorable backup). They stay because the key pins every header and each one is a column that calls
 * itself the record's id, for a person who must quote a row to us.
 */
const DELIBERATE: readonly Deliberate[] = [
  {
    sheet: 'Breakdown Log',
    column: 'Record ID',
    why: "the report's own id: the header says it is an id, and a report has no printable reference of its own",
  },
  {
    sheet: 'Cell Change Log',
    column: 'Record ID',
    why: "the move's own id: the header says it is an id, and a move has no printable reference of its own",
  },
  {
    sheet: 'PM Plan',
    column: 'Record ID',
    why: "the plan's own id: the header says it is an id, and a plan has no printable reference of its own",
  },
  {
    sheet: 'PM Reports',
    column: 'Record ID',
    why: "the closed PM job's own id: the header says it is an id",
  },
  {
    sheet: 'PM Reports',
    column: 'Data',
    why: 'the stored record as JSON, kept whole for fidelity; its plan and person ids are the record itself, not a figure',
  },
];

const KEY_SHEETS = WORKBOOK_KEY.sheets.filter((sheet) => sheet.name !== 'App Settings');

/** The header a cell sits under: the key's header row above it, or none for a title or a list row. */
function columnOf(sheet: ExportSheet, rowIndex: number, column: number): string | undefined {
  const header = KEY_SHEETS.find((key) => key.name === sheet.name)?.header;
  if (header === undefined) return undefined;
  const headerAt = sheet.rows.findIndex(
    (row) =>
      row.length === header.length &&
      row.every((cell, index) => String(cell ?? '') === header[index]),
  );
  return headerAt >= 0 && rowIndex > headerAt ? header[column] : undefined;
}

const pmIds = {
  plans: EXPORT_DATA.pmPlan ?? [],
  reports: EXPORT_DATA.pmReports ?? [],
};

/** The export input as the server builds it from a plant with UUID ids (`exportDataFor`). */
function uuidInput(): ExportData {
  const data = rekeyToUuids(ENGINE_DATA);
  const spareCosts = Object.fromEntries(
    Object.entries(EXPORT_DATA.spareCosts ?? {}).map(([id, slots]) => [
      uuidFor('report', id),
      slots,
    ]),
  );
  return {
    ...EXPORT_DATA,
    data,
    spareCosts,
    pmPlan: pmIds.plans.map((row) => ({ ...row, id: uuidFor('plan', row.id) })),
    pmReports: pmIds.reports.map((row) => ({
      ...row,
      id: uuidFor('ticket', row.id),
      data: {
        ...(row.data as object),
        doneBy: uuidFor('person', 'doer'),
        planId: uuidFor('plan', 'plan'),
      },
    })),
  };
}

/** Every UUID the re-keying made, read back as the id the fixture holds. */
function readBack(): Map<string, string> {
  const back = originalIds(ENGINE_DATA);
  for (const row of pmIds.plans) back.set(uuidFor('plan', row.id), row.id);
  for (const row of pmIds.reports) back.set(uuidFor('ticket', row.id), row.id);
  back.set(uuidFor('person', 'doer'), 'doer');
  back.set(uuidFor('plan', 'plan'), 'plan');
  return back;
}

describe('the Excel workbook prints no database id', () => {
  const input = uuidInput();
  const sheets = workbookSheets(input);

  it('runs over a plant whose ids are UUIDs, so the guard is not vacuous', () => {
    expect(input.data.machines.length).toBeGreaterThan(100);
    expect(input.data.machines.every((machine) => isUuid(machine.id))).toBe(true);
    expect(input.data.machines.every((machine) => machine.id !== machine.code)).toBe(true);
    expect(input.data.reports.every((report) => isUuid(report.id))).toBe(true);
    expect(sheets.length).toBe(17);
  });

  it('shows no UUID in a cell a person reads', () => {
    const found = new Map<string, string>();
    for (const sheet of sheets) {
      sheet.rows.forEach((row: ExportRow, rowIndex) =>
        row.forEach((value, column) => {
          if (typeof value !== 'string' || !UUID_IN_TEXT.test(value)) return;
          const header = columnOf(sheet, rowIndex, column);
          if (DELIBERATE.some((entry) => entry.sheet === sheet.name && entry.column === header)) {
            return;
          }
          found.set(
            `${sheet.name} / ${header ?? 'row ' + String(rowIndex + 1)}`,
            value.slice(0, 60),
          );
        }),
      );
    }
    expect([...found].map(([where, sample]) => `${where}  e.g. ${sample}`).sort()).toEqual([]);
  });

  it('lets a UUID through only in the columns that say they are an id, and each one carries it', () => {
    const carried = new Set<string>();
    for (const sheet of sheets) {
      sheet.rows.forEach((row: ExportRow, rowIndex) =>
        row.forEach((value, column) => {
          if (typeof value !== 'string' || !UUID_IN_TEXT.test(value)) return;
          carried.add(`${sheet.name} / ${columnOf(sheet, rowIndex, column)}`);
        }),
      );
    }
    for (const entry of DELIBERATE)
      expect(carried, entry.why).toContain(`${entry.sheet} / ${entry.column}`);
  });

  it('prints the same workbook whatever the ids are: the same rows, codes and references', () => {
    const back = readBack();
    const plain = workbookSheets({
      ...EXPORT_DATA,
      pmReports: pmIds.reports.map((row) => ({
        ...row,
        data: { ...(row.data as object), doneBy: 'doer', planId: 'plan' },
      })),
    });
    const read = JSON.parse(
      JSON.stringify(sheets).replace(
        new RegExp(UUID_IN_TEXT, 'g'),
        (uuid) => back.get(uuid) ?? uuid,
      ),
    ) as ExportSheet[];
    expect(read.map((sheet) => sheet.name)).toEqual(plain.map((sheet) => sheet.name));
    // Rows of one day (a move, a plan) are ordered by their id, so the order of such ties, and the Sr. number that
    // counts it, is the one thing an id may change; every other cell of every row must be the same.
    const asLines = (sheet: ExportSheet | undefined): string[] => {
      const header = KEY_SHEETS.find((key) => key.name === sheet?.name)?.header;
      const numbered = header?.[0] === 'Sr.';
      return (sheet?.rows ?? [])
        .map((row) => JSON.stringify(numbered && row.length === header.length ? row.slice(1) : row))
        .sort();
    };
    for (const sheet of plain) {
      const other = read.find((candidate) => candidate.name === sheet.name);
      expect(asLines(other), sheet.name).toEqual(asLines(sheet));
    }
  });
});
