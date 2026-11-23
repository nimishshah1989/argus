import { describe, expect, it } from 'vitest';
import { DEFAULT_PROFILE } from '@uptimo/shared';
import type { EngineData } from '@uptimo/domain';
import type { PmExportReportRow } from '../tickets/index.js';
import { exportDataFor } from './export-data.js';

/**
 * G1.2b: the PM Reports sheet's Data column prints the stored report as JSON. The stored report names the person by
 * their id and the plan by its id (UUIDs); the column must print the person's coded name and leave the plan id out.
 */

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-/i;
const MACHINE = '5a1c0d6e-3b2f-4c47-9d10-0a7e4f2b9c11';
const PERSON = '7c4b1e90-2d6a-4f38-b5e1-6a9d3c0f8e22';
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

const job: PmExportReportRow = {
  ticketId: JOB,
  machineId: MACHINE,
  closedAt: new Date('2026-10-30T10:00:00Z'),
  scheduledOn: '2026-10-30',
  report: { total: 2, undone: [], readings: {}, comments: null, doneBy: PERSON, planId: PLAN },
};

describe('the PM Reports Data column', () => {
  it('prints the person by their coded name and no database id', () => {
    const [row] =
      exportDataFor({
        data,
        profile: DEFAULT_PROFILE,
        tenant: 'plant-a',
        asOf: '2026-11-11',
        pmReports: [job],
      }).pmReports ?? [];
    expect(JSON.stringify(row?.data)).not.toMatch(UUID);
    expect(row?.data).toMatchObject({ doneBy: 'P-7c4b1e90' });
  });
});
