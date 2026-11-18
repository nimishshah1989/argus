import { DEFAULT_PROFILE } from '@uptimo/shared';
import { describe, expect, it } from 'vitest';
import {
  COMPUTERS,
  runWith,
  type Computed,
  type EngineData,
  type FigureResult,
  type ReportRow,
} from '../src/index.js';
import { ENGINE_DATA, read } from './answer-key/fixture.js';

/**
 * The Team Focus figure (ticket 43, packet 43b): the whole frozen 11 November key — three KPI tiles and the month's
 * ranked actions with their hours at stake. The actions' status, owner and note are the defaults the platform shows
 * before anyone touches them; their persistence is a later server packet, not this figure.
 *
 * The fixture maps the live engine's one spare field; the legacy workbook kept three spare names and three cost
 * columns, and the two spares in the second and third columns change the part counts. The test supplies those legacy
 * columns from the same workbook the fixture reads, so the figure is computed from the data the key was frozen from.
 */

const AS_OF = '2026-11-11';

interface FocusAction {
  key: string;
  lane: string;
  machine?: string;
  title: string;
  stake: number;
  status: string;
  owner: string;
  note: string;
}

interface TeamFocusKey {
  screen: string;
  asOf: string;
  pages: unknown[];
  extra: FocusAction[];
}

/** One workbook breakdown with the legacy spare and cost columns the live engine does not carry. */
interface LegacyRow {
  id: string;
  spare2?: string;
  spare3?: string;
  cost1?: number;
  cost2?: number;
  cost3?: number;
}

const TEAM_FOCUS = read<TeamFocusKey>('team-focus.json');
const RAW = read<{ breakdowns: LegacyRow[]; otherBD: LegacyRow[] }>('input.json');

/** The legacy spare and cost columns, by the report id the engine's rows carry. */
const LEGACY = new Map(
  [...RAW.breakdowns, ...RAW.otherBD].map((row) => [
    row.id,
    {
      spare2: row.spare2 ?? null,
      spare3: row.spare3 ?? null,
      spareCost: (row.cost1 ?? 0) + (row.cost2 ?? 0) + (row.cost3 ?? 0),
    },
  ]),
);

const DATA: EngineData = {
  ...ENGINE_DATA,
  reports: ENGINE_DATA.reports.map((report): ReportRow => ({
    ...report,
    ...(LEGACY.get(report.id) ?? {}),
  })),
};

function compute(data: EngineData = DATA): FigureResult {
  const result = runWith(COMPUTERS, { data, asOf: AS_OF, profile: DEFAULT_PROFILE });
  const found = result.figures.find((candidate) => candidate.key === 'team-focus');
  if (!found) throw new Error('the engine knows no figure team-focus');
  return found;
}

/** The computer itself, so the drill's own order (before the engine sorts and dedupes it) is observable. */
function runComputer(data: EngineData = DATA): Computed {
  const figure = COMPUTERS['team-focus'];
  if (figure === undefined) throw new Error('the engine knows no figure team-focus');
  return figure({ data, asOf: AS_OF, profile: DEFAULT_PROFILE });
}

/** The machines the key's actions name, in the order the actions name them. */
const actionMachines = (): string[] => [
  ...new Set(
    TEAM_FOCUS.extra.flatMap((action) => (action.machine === undefined ? [] : [action.machine])),
  ),
];

describe('the Team Focus figure', () => {
  it("equals the key's whole figure: the three KPI tiles and every ranked action", () => {
    const computed = compute();
    // Red first: 43b had not landed, so the engine answered not_computed for this key.
    expect(computed.status).toBe('ready');
    expect(computed.value).toEqual(TEAM_FOCUS);
  });

  it('drills the machines its actions name, and every id is a real machine', () => {
    const expected = actionMachines();
    expect(expected.length).toBeGreaterThan(0);
    // The computer names the machines in action order; the engine then dedupes and sorts them.
    expect(runComputer().drillIds).toEqual(expected);
    const computed = compute();
    expect(computed.drill.type).toBe('machine');
    expect(computed.drill.ids).toEqual([...expected].sort());
    const known = new Set(DATA.machines.map((machine) => machine.id));
    for (const id of computed.drill.ids) expect(known.has(id), id).toBe(true);
  });

  it('prints the three KPIs the key pins, exact', () => {
    const page = TEAM_FOCUS.pages[0] as {
      kpis: Array<{ label: string; value: string; sub: string }>;
    };
    expect(page.kpis).toEqual([
      { label: 'Actions', value: '31', sub: '31 not started, 0 in progress' },
      { label: 'Done', value: '0', sub: '0 marked not needed' },
      { label: 'Progress', value: '0%', sub: 'of actions done or not needed' },
    ]);
    expect(compute().value).toMatchObject({ pages: [{ kpis: page.kpis, tables: [], charts: [] }] });
  });
});
