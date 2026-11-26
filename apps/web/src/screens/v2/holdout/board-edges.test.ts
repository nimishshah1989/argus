// @vitest-environment node
import { describe, expect, it } from 'vitest';
import '../../../i18n/index.js';
import type { BoardToday, Config, State, Ticket } from '../../../api.js';
import { boardModel } from '../board/adapter.js';
import {
  FIXTURE_NOW,
  breakdown,
  fixtureConfig,
  fixtureState,
  fixtureToday,
} from '../board/fixture.js';
import { realT } from '../printed-page/test-support.js';

/**
 * Hidden (ticket 772, S30 Board; ADR 0034: figures, missing data, permissions only). A refused or missing day score
 * leaves dashes and keeps the stops (v1 has no on-screen refusal); nothing to average is never "0 min"; off-board and
 * hidden-group machines never count; a running machine or a work request is not a stop; an empty plant invents nothing.
 */
const model = (
  open: Ticket[],
  over: Partial<{ today: BoardToday | undefined; tv: boolean; config: Config }> = {},
) =>
  boardModel(
    {
      state: { ...fixtureState, open } as State,
      config: over.config ?? fixtureConfig,
      today: 'today' in over ? over.today : fixtureToday,
      tv: over.tv ?? false,
    },
    realT,
  );

describe('S30 board: the day score', () => {
  it('a refused or missing day score (403 on /board/today) leaves dashes and keeps the stops', () => {
    const m = model(fixtureState.open, { today: undefined });
    expect(m.today.map((tile) => [tile.value, tile.note])).toEqual([
      ['—', null],
      ['—', null],
    ]);
    expect(m.pulse.stopped).toBe(8);
    expect(m.columns.map((c) => c.rows.length)).toEqual([3, 4, 1]);
  });

  it('a day with nothing to average shows a dash, never 0 min, and no basis line', () => {
    const empty: BoardToday = {
      ...fixtureToday,
      responseMin: null,
      repairMin: null,
      responseCount: 0,
      responseClosed: 0,
      repairCount: 0,
      repairClosed: 0,
    };
    const m = model(fixtureState.open, { today: empty });
    expect(m.today.map((tile) => [tile.value, tile.note])).toEqual([
      ['—', null],
      ['—', null],
    ]);
  });
});

describe('S30 board: which machines count', () => {
  it('never counts a machine off the board or in a hidden group, even when it is the oldest stop', () => {
    const m = model(fixtureState.open);
    expect(m.pulse).toMatchObject({ machines: 12, stopped: 8, running: 4 });
    const codes = m.columns.flatMap((c) => c.rows.map((r) => r.code));
    expect(codes).not.toContain('OB-01');
    expect(codes).not.toContain('HG-01');
    expect(m.ages.buckets.find((b) => b.key === 'overDay')?.count).toBe(1);
    expect(m.takeaways['board.stops']?.outlier).toBe('m-PR-02');
  });

  it('a machine running again is not stopped; a work request never stops a machine', () => {
    const open = [
      breakdown('PR-02', 'open', 310, { machineRunningAt: FIXTURE_NOW }),
      breakdown('LT-08', 'open', 50, { kind: 'general' } as Partial<Ticket>),
    ];
    const m = model(open);
    expect(m.pulse).toMatchObject({ stopped: 0, running: 12 });
    expect(m.columns.map((c) => c.count)).toEqual([0, 0, 0]);
  });

  it('an empty plant: 0 of 0 machines, empty columns, no takeaway and no Longest mark', () => {
    const bare = { ...fixtureConfig, machines: [] } as unknown as Config;
    const m = model([], { config: bare, today: undefined });
    expect(m.pulse).toMatchObject({ machines: 0, running: 0, stopped: 0 });
    expect(m.columns.map((c) => [c.count, c.rows.length, c.more])).toEqual([
      [0, 0, null],
      [0, 0, null],
      [0, 0, null],
    ]);
    expect(m.ages.buckets.map((b) => b.count)).toEqual([0, 0, 0, 0]);
    expect(m.takeaways).toEqual({ 'board.stops': null, 'board.ages': null });
  });
});

describe('S30 board: the takeaway figures', () => {
  it('counts every day-old stop, in any column', () => {
    const m = model([breakdown('PR-02', 'open', 3000), breakdown('CP-02', 'working', 2000)]);
    expect(m.takeaways['board.stops']?.text).toContain('2 d 2 h');
    expect(m.takeaways['board.stops']?.text).toMatch(/\b2 breakdowns\b/);
    expect(m.takeaways['board.ages']?.text).toContain('0 of 2');
  });

  it('names no machine when nobody waits unstarted, and marks no row Longest', () => {
    const m = model([breakdown('CP-02', 'working', 30)]);
    expect(m.takeaways['board.stops']).toBeNull();
    expect(m.columns.flatMap((c) => c.rows).some((r) => r.longest)).toBe(false);
    expect(m.takeaways['board.ages']?.text).toContain('1 of 1');
  });

  it('the TV cap keeps the oldest stops and counts the rest', () => {
    const codes = ['VC-01', 'VC-02', 'VC-03', 'VC-09', 'VC-17'];
    const open = codes.map((code, i) => breakdown(code, 'open', (i + 1) * 10));
    const tv = model(open, { tv: true }).columns[0]!;
    expect(tv.count).toBe(5);
    expect(tv.rows.map((r) => r.code)).toEqual(['VC-17', 'VC-09', 'VC-03']);
    expect(tv.more).toContain('2');
    expect(model(open).columns[0]!.rows).toHaveLength(5);
  });
});
