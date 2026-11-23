import { describe, expect, it } from 'vitest';
import { DEFAULT_PROFILE } from '@uptimo/shared';
import type { EngineData } from '@uptimo/domain';
import type { PmExportReportRow } from '../tickets/index.js';
import { exportDataFor } from './export-data.js';

/**
 * The PM sheets' inputs are built here from the plant's rows, whose ids are UUIDs: the workbook must read the machine's
 * code and the person's coded name, and a row naming one the plant does not list prints a dash, never the id. Pure, so
 * it runs without a database; `workbook-route` and `report-export.test.ts` carry the download itself.
 */

const MACHINE = '5a1c0d6e-3b2f-4c47-9d10-0a7e4f2b9c11';
const GONE_MACHINE = '9e3f7a20-81c4-4d5b-a6f2-2c0b8d1e5f33';
const PERSON = '7c4b1e90-2d6a-4f38-b5e1-6a9d3c0f8e22';
const GONE_PERSON = 'c2d8f410-5e7b-4a96-8f03-1b6a9e4d7c55';
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

const job = (machineId: string, doneBy: string | null): PmExportReportRow => ({
  ticketId: JOB,
  machineId,
  closedAt: new Date('2026-10-30T10:00:00Z'),
  scheduledOn: '2026-10-30',
  report: { total: 2, undone: [], readings: {}, comments: null, doneBy },
});

const reportsFor = (rows: PmExportReportRow[]) =>
  exportDataFor({
    data,
    profile: DEFAULT_PROFILE,
    tenant: 'plant-a',
    asOf: '2026-11-11',
    pmReports: rows,
  }).pmReports ?? [];

describe('the PM Reports sheet input', () => {
  it('names the machine by its code and the person by their coded name', () => {
    const [row] = reportsFor([job(MACHINE, PERSON)]);
    expect(row?.machineId).toBe('VC-02');
    expect(row?.doneBy).toBe('P-7c4b1e90');
  });

  it('prints a dash for a machine or a person the plant does not list, and a blank for nobody', () => {
    const rows = reportsFor([job(GONE_MACHINE, GONE_PERSON), job(MACHINE, null)]);
    expect([rows[0]?.machineId, rows[0]?.doneBy]).toEqual(['-', '-']);
    expect(rows[1]?.doneBy).toBeNull();
  });
});
