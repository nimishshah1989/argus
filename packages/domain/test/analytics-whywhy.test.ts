import { DEFAULT_PROFILE } from '@uptimo/shared';
import { describe, expect, it } from 'vitest';
import {
  COMPUTERS,
  runWith,
  type EngineData,
  type FigureResult,
  type ReportRow,
} from '../src/index.js';
import { formatNumber, normalizeLabel } from '../src/analytics/format.js';
import { isProduction } from '../src/analytics/machine-facts.js';
import { dmy } from '../src/analytics/plant-date.js';
import { isPm, sourcedReports } from '../src/analytics/rows.js';
import { A6, ENGINE_DATA, type FigureKey } from './answer-key/fixture.js';

/**
 * The A6 Why-Why figure (packet 41c): the platform's whole page against the frozen 11 November key — one table of
 * the breakdowns over the Why-Why threshold, sorted by the raw recorded hours and never a tolerance. The key is the
 * authority; the assertions below also derive the candidate set and the drill from the workbook, so a hard-coded
 * page cannot pass.
 */

const AS_OF = '2026-11-11';
const TITLE = 'Why-Why (Root Cause) Analysis';

function compute(data: EngineData = ENGINE_DATA): FigureResult {
  const result = runWith(COMPUTERS, { data, asOf: AS_OF, profile: DEFAULT_PROFILE });
  const found = result.figures.find((candidate) => candidate.key === 'a6-why-why');
  if (!found) throw new Error('the engine knows no figure a6-why-why');
  return found;
}

function valueOf(data: EngineData = ENGINE_DATA): FigureKey {
  return compute(data).value as unknown as FigureKey;
}

function table(value: FigureKey) {
  const found = value.pages[0]?.tables.find((candidate) => candidate.title === TITLE);
  if (!found) throw new Error(`the A6 page holds no table titled "${TITLE}"`);
  return found;
}

/** The raw recorded hours the figure reads: the legacy column when present, the minutes otherwise. */
const rawHours = (report: ReportRow): number => report.recordedHours ?? report.downtimeMin / 60;

/** The production fleet: CNC machines the plant counts in production data. */
const PRODUCTION = new Set(ENGINE_DATA.machines.filter(isProduction).map((machine) => machine.id));

/** The candidates the key's 24 rows are: production non-PM rows over the threshold, raw hours descending. */
const CANDIDATES = sourcedReports(ENGINE_DATA)
  .filter(
    (row) =>
      PRODUCTION.has(row.report.machineId) &&
      !isPm(row) &&
      rawHours(row.report) > DEFAULT_PROFILE.whyWhyThresholdHours,
  )
  .sort((left, right) => rawHours(right.report) - rawHours(left.report));

/** The machine a candidate row sits on; a report always names one in the fixture. */
function machineOf(machineId: string) {
  const machine = ENGINE_DATA.machines.find((candidate) => candidate.id === machineId);
  if (machine === undefined) throw new Error(`the fixture holds no machine "${machineId}"`);
  return machine;
}

describe('the A6 Why-Why figure', () => {
  it("equals the key's whole page: the one candidate table and nothing else", () => {
    const computed = compute();
    // Red first: the A6 computer had not landed, so the engine answered not_computed.
    expect(computed.status).toBe('ready');
    expect(computed.value).toEqual(A6);
  });

  it('drills the candidate tickets it read, derived from the workbook', () => {
    const computed = compute();
    const known = new Set(
      [...ENGINE_DATA.tickets, ...ENGINE_DATA.tasks].map((ticket) => ticket.id),
    );
    expect(CANDIDATES).toHaveLength(24);
    // The sixth row is the NO-DT row: the raw selector keeps its 59.98 where the effective one would zero it.
    expect(CANDIDATES[5]?.report.maintCode).toBe('NO DT');
    expect(rawHours(CANDIDATES[5]!.report)).toBeCloseTo(59.98, 2);
    const expected = [...new Set(CANDIDATES.map((row) => row.ticket.id))].sort();
    expect(expected).toHaveLength(CANDIDATES.length);
    expect(computed.drill.ids).toEqual(expected);
    expect(computed.drill.ids).toEqual([...new Set(computed.drill.ids)]);
    expect(computed.drill.ids.every((id) => known.has(id))).toBe(true);
    expect(computed.drill.type).toBe('ticket');
  });

  it('marks one candidate completed from a saved record: one row changes, the drill does not', () => {
    const first = CANDIDATES[0];
    if (first === undefined) throw new Error('the fixture has no Why-Why candidate');
    const machine = machineOf(first.report.machineId);
    const before = table(valueOf());
    const index = before.rows.findIndex(
      (row) =>
        row[0] === machine.code &&
        row[1] === dmy(first.report.date) &&
        row[2] === normalizeLabel(first.report.problem) &&
        row[3] === formatNumber(rawHours(first.report), 2),
    );
    expect(index).toBeGreaterThanOrEqual(0);
    // The key prints every candidate as not started, so the saved record is the only thing that can move a cell.
    expect(before.rows.every((row) => row[4] === 'Not Started')).toBe(true);
    const grown: EngineData = {
      ...ENGINE_DATA,
      whyWhy: [
        {
          ticketId: first.ticket.id,
          whys: ['One', 'Two', 'Three', 'Four', 'Five'],
          conclusion: 'The drive was replaced after the same alarm repeated.',
          completedBy: ENGINE_DATA.people[0]!.code,
          completedDate: '2026-11-10',
        },
      ],
    };
    const after = table(valueOf(grown));
    const expected = before.rows.map((row, position) =>
      position === index ? [...row.slice(0, 4), 'Completed', 'View / EditPDF'] : row,
    );
    expect(after.rows).toEqual(expected);
    expect(after.rows[index]?.[4]).toBe('Completed');
    expect(after.rows[index]?.[5]).toBe('View / EditPDF');
    expect(after.rows.filter((_, position) => position !== index)).toEqual(
      before.rows.filter((_, position) => position !== index),
    );
    expect(after.header).toEqual(before.header);
    expect(compute(grown).drill.ids).toEqual(compute().drill.ids);
  });
});
