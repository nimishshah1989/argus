import { DEFAULT_PROFILE } from '@uptimo/shared';
import { describe, expect, it } from 'vitest';
import { COMPUTERS, runWith, type EngineData, type FigureResult } from '../src/index.js';
import { actionCenterBoard, actionCenterFigure } from '../src/analytics/action-center-figure.js';
import { ACTION_CENTER, ENGINE_DATA, type KeyFigurePage } from './answer-key/fixture.js';

/**
 * The Action Center figure, its machine table and its board (ticket 44, packet 44b). The first test is the frozen
 * 11 November key whole, with no tolerance. The other four pin the parts the whole-value test cannot show: the drill
 * order (the computer's nudge order and the engine's sorted ids), the board's 36 open statuses, the board risk rows
 * against the key's page rows, and the empty plant's honest null. Nothing here reads the key as input: the six acks
 * come from the fixture's Excel workbook, and the tests prove the figure echoes that input.
 */

const AS_OF = '2026-11-11';
const AC_SCREEN = 'action-center';
const INPUT = { data: ENGINE_DATA, asOf: AS_OF, profile: DEFAULT_PROFILE };

/** A plant with no rows at all: the figure must say so rather than invent one. */
const EMPTY: EngineData = {
  ...ENGINE_DATA,
  machines: [],
  moves: [],
  tickets: [],
  tasks: [],
  reports: [],
  people: [],
  whyWhy: [],
  amc: [],
  legal: [],
  settings: { ...ENGINE_DATA.settings!, nudgeAcks: {} },
};

type EngineResult = ReturnType<typeof runWith>;

function figureOf(result: EngineResult, key: string): FigureResult {
  const found = result.figures.find((candidate) => candidate.key === key);
  if (found === undefined) throw new Error(`the engine knows no figure ${key}`);
  return found;
}

const FULL = runWith(COMPUTERS, INPUT);
const EMPTY_RESULT = runWith(COMPUTERS, { ...INPUT, data: EMPTY });
const AC_RESULT = figureOf(FULL, AC_SCREEN);
const AC_EMPTY = figureOf(EMPTY_RESULT, AC_SCREEN);
const PAGE = ACTION_CENTER.pages[0] as KeyFigurePage;
const RISK_ROWS = PAGE.tables[0]!.rows;

/** The distinct machines the key's nudges name, in the nudges' own order. */
const KEY_MACHINES = [...new Set(ACTION_CENTER.extra.nudges.flatMap((nudge) => nudge.machines))];

describe('the whole Action Center value', () => {
  it('prints the 11 November key whole: one page, no KPI, one table and no chart', () => {
    expect(AC_RESULT.status).toBe('ready');
    expect(AC_RESULT.value).toEqual(ACTION_CENTER);
    const value = AC_RESULT.value as unknown as { pages: KeyFigurePage[] };
    const page = value.pages[0]!;
    expect(page.title).toBe('Action Center');
    expect(page.kpis).toEqual([]);
    expect(page.tables).toHaveLength(1);
    expect(page.tables[0]!.title).toBe('Machines needing attention');
    expect(page.tables[0]!.rows).toHaveLength(8);
    expect(page.charts).toEqual([]);
  });

  it('echoes the six stored acks the workbook feeds it, stale keys included', () => {
    const value = AC_RESULT.value as unknown as { extra: { acks: Record<string, unknown> } };
    expect(value.extra.acks).toEqual(ENGINE_DATA.settings?.nudgeAcks);
    expect(Object.keys(value.extra.acks)).toHaveLength(6);
    expect(value.extra.acks).toEqual(ACTION_CENTER.extra.acks);
  });
});

describe('the Action Center drill and board', () => {
  it('drills every machine the nudges name, deduped, and the engine sorts the same ids', () => {
    const direct = actionCenterFigure(INPUT);
    const known = new Set(ENGINE_DATA.machines.map((machine) => machine.id));
    expect(direct.drillIds).toEqual(KEY_MACHINES);
    expect(direct.drillIds).toHaveLength(29);
    expect(direct.drillIds.every((id) => known.has(id))).toBe(true);
    expect(AC_RESULT.drill.type).toBe('machine');
    expect(AC_RESULT.drill.ids).toEqual([...KEY_MACHINES].sort());
  });

  it('lists all 36 board nudges open and counts them by status and severity', () => {
    const board = actionCenterBoard(INPUT);
    expect(board.asOf).toBe(AS_OF);
    expect(board.snoozeDays).toBe(DEFAULT_PROFILE.snoozeDays);
    expect(board.types).toEqual(ACTION_CENTER.extra.types);
    expect(board.nudges).toHaveLength(36);
    expect(board.nudges.every((nudge) => nudge.status === 'open')).toBe(true);
    expect(board.counts).toEqual({ open: 36, ack: 0, snoozed: 0, resolved: 0 });
    expect(board.bySeverity).toEqual({ high: 6, med: 28, low: 2, info: 0 });
    // Of the six stored acks, these two name a live nudge and both have newer evidence, so they reopen.
    for (const key of ['freq|VC-16', 'freq|GRD-2']) {
      const nudge = board.nudges.find((candidate) => candidate.key === key);
      expect(nudge?.ack, key).not.toBeNull();
      expect(nudge?.reopened, key).toBe(true);
    }
    expect(board.nudges.filter((nudge) => nudge.reopened)).toHaveLength(2);
    // The other four acks are stored against nudge keys that no longer fire, so no card inherits them.
    expect(board.nudges.filter((nudge) => nudge.ack !== null)).toHaveLength(2);
  });

  it('ranks the board risk exactly as the key page rows, and the page prints the same rows', () => {
    const board = actionCenterBoard(INPUT);
    const rows = board.risk.map((row) => [
      `${row.machine} ${row.model}`.trim(),
      String(row.score),
      row.why,
    ]);
    expect(rows).toEqual(RISK_ROWS);
    expect(board.risk).toHaveLength(8);
    const page = (AC_RESULT.value as unknown as { pages: KeyFigurePage[] }).pages[0]!;
    expect(page.tables[0]!.rows).toEqual(rows);
  });
});

describe('the Action Center on an empty plant', () => {
  it('answers null, with no page and no row to drill', () => {
    const direct = actionCenterFigure({ ...INPUT, data: EMPTY });
    expect(direct.value).toBeNull();
    expect(direct.drillIds).toEqual([]);
    expect(AC_EMPTY.status).toBe('ready');
    expect(AC_EMPTY.value).toBeNull();
    expect(AC_EMPTY.drill.ids).toEqual([]);
  });
});
