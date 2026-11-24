import { DEFAULT_PROFILE } from '@uptimo/shared';
import { describe, expect, it } from 'vitest';
import {
  COMPUTERS,
  runWith,
  type Computed,
  type EngineData,
  type FigureResult,
} from '../src/index.js';
import { ENGINE_DATA, read } from './answer-key/fixture.js';
import { withoutCodeFields } from './answer-key/rekey.js';

/**
 * The Team Focus figure (ticket 43, packet 43b): the whole frozen 11 November key — three KPI tiles and the month's
 * ranked actions with their hours at stake. The actions' status, owner and note are the defaults the platform shows
 * before anyone touches them; their persistence is a later server packet, not this figure.
 *
 * The shared answer-key fixture maps the legacy workbook's three spare columns into `ReportRow.spares`, so this test
 * reads the same seam production does, with no private enrichment.
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

const TEAM_FOCUS = read<TeamFocusKey>('team-focus.json');

function compute(data: EngineData = ENGINE_DATA): FigureResult {
  const result = runWith(COMPUTERS, { data, asOf: AS_OF, profile: DEFAULT_PROFILE });
  const found = result.figures.find((candidate) => candidate.key === 'team-focus');
  if (!found) throw new Error('the engine knows no figure team-focus');
  return found;
}

/** The computer itself, so the drill's own order (before the engine sorts and dedupes it) is observable. */
function runComputer(data: EngineData = ENGINE_DATA): Computed {
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
    // `period` is newer than the frozen key (TF-2, ADR 0020); the next test pins it.
    const { period: _period, ...whole } = computed.value as Record<string, unknown>;
    expect(withoutCodeFields(whole)).toEqual(TEAM_FOCUS);
  });

  it('publishes the month it plans as `period` (YYYY-MM), the key the saved notes are stored under (ADR 0020)', () => {
    // The key's last breakdown is in November 2026, so the plan is for December; lane A's keys carry the same month.
    expect((compute().value as { period?: unknown }).period).toBe('2026-12');
    expect(TEAM_FOCUS.extra[0]?.key).toBe('fc|WJ-01|2026-12');
  });

  it('drills the machines its actions name, and every id is a real machine', () => {
    const expected = actionMachines();
    expect(expected.length).toBeGreaterThan(0);
    // The computer names the machines in action order; the engine then dedupes and sorts them.
    expect(runComputer().drillIds).toEqual(expected);
    const computed = compute();
    expect(computed.drill.type).toBe('machine');
    expect(computed.drill.ids).toEqual([...expected].sort());
    const known = new Set(ENGINE_DATA.machines.map((machine) => machine.id));
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
