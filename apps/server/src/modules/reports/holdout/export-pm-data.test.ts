import { describe, expect, it } from 'vitest';
import { DEFAULT_PROFILE } from '@uptimo/shared';
import { workbookSheets, type EngineData } from '@uptimo/domain';
import type { PmExportReportRow } from '../../tickets/index.js';
import { exportDataFor } from '../export-data.js';

/** G1.2b hidden: the Data column's edge cases and the sheet as written. */

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-/i;
const MACHINE = '5a1c0d6e-3b2f-4c47-9d10-0a7e4f2b9c11';
const PERSON = '7c4b1e90-2d6a-4f38-b5e1-6a9d3c0f8e22';
const GONE_PERSON = 'c2d8f410-5e7b-4a96-8f03-1b6a9e4d7c55';
const PLAN = '3d9e6b21-4a7c-4f10-8b2e-9c5a1d7f0e44';
const JOB = 'b6e2a9d4-0c1f-4e83-97a5-3d8f1c6b2a77';

const data = {
  timeZone: 'Asia/Kolkata',
  machines: [{ id: MACHINE, code: 'VC-02' }],
  moves: [],
  tickets: [],
  tasks: [],
  reports: [],
  people: [{ id: PERSON, code: 'P-7c4b1e90', displayName: 'P-7c4b1e90' }],
  lists: {},
} as unknown as EngineData;

const stored = (doneBy: string | null, planId?: string) => ({
  total: 3,
  undone: ['2'],
  readings: { Oil: 4.5 },
  comments: 'Belt worn',
  doneBy,
  ...(planId === undefined ? {} : { planId }),
});
const job = (report: Record<string, unknown>): PmExportReportRow => ({
  ticketId: JOB,
  machineId: MACHINE,
  closedAt: new Date('2026-10-30T10:00:00Z'),
  scheduledOn: '2026-10-30',
  report,
});
const input = (rows: PmExportReportRow[]) =>
  exportDataFor({
    data,
    profile: DEFAULT_PROFILE,
    tenant: 'plant-a',
    asOf: '2026-11-11',
    pmReports: rows,
  });
const dataOf = (report: Record<string, unknown>) =>
  (input([job(report)]).pmReports ?? [])[0]?.data as Record<string, unknown> | undefined;

describe('the PM Reports Data column, hidden checks', () => {
  it('prints a person the plant no longer lists as a dash', () => {
    const printed = dataOf(stored(GONE_PERSON, PLAN));
    expect(printed?.doneBy).toBe('-');
    expect(JSON.stringify(printed)).not.toMatch(UUID);
  });

  it('keeps nobody as null', () => {
    expect(dataOf(stored(null, PLAN))?.doneBy).toBeNull();
  });

  it('leaves the plan id out, whether or not the report has one', () => {
    expect(dataOf(stored(PERSON, PLAN))).not.toHaveProperty('planId');
    expect(dataOf(stored(PERSON))).not.toHaveProperty('planId');
  });

  it('keeps every other field of the stored report as it was', () => {
    expect(dataOf(stored(PERSON, PLAN))).toEqual({
      total: 3,
      undone: ['2'],
      readings: { Oil: 4.5 },
      comments: 'Belt worn',
      doneBy: 'P-7c4b1e90',
    });
  });

  it('does not change the stored report it was given', () => {
    const report = stored(PERSON, PLAN);
    dataOf(report);
    expect(report).toEqual(stored(PERSON, PLAN));
  });

  it('writes a PM Reports sheet whose Data column holds no UUID', () => {
    const sheet = workbookSheets(input([job(stored(PERSON, PLAN)), job(stored(GONE_PERSON))])).find(
      (candidate) => candidate.name === 'PM Reports',
    );
    const [header, ...rows] = sheet?.rows ?? [];
    const at = (header ?? []).indexOf('Data');
    expect(at).toBeGreaterThanOrEqual(0);
    expect(rows).toHaveLength(2);
    for (const row of rows) expect(String(row[at])).not.toMatch(UUID);
  });
});
