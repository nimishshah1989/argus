import { describe, expect, it } from 'vitest';
import type { FiguresReply } from '@uptimo/shared/analytics';
import {
  figureMeasure,
  figurePlaces,
  formatFigure,
  roundMove,
  toneOfChange,
} from '../../ui/meaning/index.js';
import { problemItems } from './TodayFigures.js';
import { changeOf, priorDate } from './today-change.js';

type Figure = FiguresReply['figures'][number];
const figure = (key: string, value: unknown, status: Figure['status'] = 'ready'): Figure => ({
  key,
  screen: 'dashboard',
  owner: 38,
  status,
  value: value as Figure['value'],
  drill: { type: 'machine', ids: [] },
});

describe('Today change against the prior period', () => {
  it('goes back 30 calendar days, across a month and a year end', () => {
    expect(priorDate('2026-11-19')).toBe('2026-10-20');
    expect(priorDate('2026-01-10')).toBe('2025-12-11');
  });

  it('a rate keeps its good direction: availability falling is bad', () => {
    const change = changeOf(
      figure('dashboard.fleet-availability', 93.1),
      figure('dashboard.fleet-availability', 94.4),
    );
    expect(change?.delta).toBe(-1.3);
    expect(toneOfChange(change!.measure.better, change!.delta)).toBe('bad');
  });

  it('a running total is an amount added, with no verdict', () => {
    const change = changeOf(
      figure('dashboard.total-downtime-hours', 120.5),
      figure('dashboard.total-downtime-hours', 100),
    );
    expect(change?.delta).toBe(20.5);
    expect(change?.added).toBe(true);
    const rate = changeOf(figure('dashboard.plant-bd-pct', 3), figure('dashboard.plant-bd-pct', 4));
    expect(rate?.added).toBe(false);
  });

  it('the whole downtime per CNC machine is a running total too', () => {
    const change = changeOf(
      figure('dashboard.avg-bd-hours-per-machine', 41.26),
      figure('dashboard.avg-bd-hours-per-machine', 40.1),
    );
    expect(change?.added).toBe(true);
  });

  it('a year-to-date figure shows no change when the prior date is in the year before', () => {
    const now = figure('dashboard.fleet-availability', 96);
    const december = figure('dashboard.fleet-availability', 91);
    expect(priorDate('2026-01-15')).toBe('2025-12-16');
    expect(changeOf(now, december, false)).toBeUndefined();
    expect(changeOf(now, december, true)?.delta).toBe(5);
    const total = changeOf(
      figure('dashboard.total-breakdowns', 1343),
      figure('dashboard.total-breakdowns', 1300),
      false,
    );
    expect(total?.delta).toBe(43);
  });

  it('shows no change for a fleet count, a held figure or a figure with no prior value', () => {
    expect(
      changeOf(figure('dashboard.cnc-machines', 52), figure('dashboard.cnc-machines', 50)),
    ).toBeUndefined();
    expect(
      changeOf(
        figure('dashboard.plant-bd-pct', null, 'not_computed'),
        figure('dashboard.plant-bd-pct', 3),
      ),
    ).toBeUndefined();
    expect(changeOf(figure('dashboard.plant-bd-pct', 3), undefined)).toBeUndefined();
  });

  it('reads the clean machines of the breakdown-free sentence', () => {
    const now = figure('dashboard.breakdown-free', { runningClean: 41, inService: 90 });
    const was = figure('dashboard.breakdown-free', { runningClean: 38, inService: 90 });
    expect(changeOf(now, was)?.delta).toBe(3);
  });
});

describe('how a Today figure prints exactly', () => {
  const print = (key: string, value: number) => {
    const measure = figureMeasure(key);
    const places = figurePlaces(measure, value);
    return formatFigure(measure, value, places, places);
  };

  it("keeps the engine's places, with Indian grouping and the unit", () => {
    expect(print('dashboard.total-breakdowns', 1343)).toBe('1,343');
    expect(print('dashboard.total-downtime-hours', 2145.5)).toBe('2,145.5 hrs');
    expect(print('dashboard.pm-hours', 412.25)).toBe('412.25 hrs');
    expect(print('dashboard.fleet-availability', 94.37)).toBe('94.37%');
    expect(print('dashboard.total-breakdowns', 120000)).toBe('1,20,000');
  });

  it('prints a whole number of hours with one decimal, as the old platform did', () => {
    expect(print('dashboard.total-downtime-hours', 120)).toBe('120.0 hrs');
    expect(print('dashboard.avg-bd-hours-per-day', 3)).toBe('3.0 hrs/day');
    expect(print('dashboard.cnc-machines', 52)).toBe('52');
  });
});

describe('rounding a move', () => {
  it('treats +0.05 and -0.05 alike, so neither is called no change while the other is a change', () => {
    expect(roundMove(0.05)).toBe(0.1);
    expect(roundMove(-0.05)).toBe(-0.1);
    expect(roundMove(0.04)).toBe(0);
    expect(roundMove(-0.04)).toBe(0);
    expect(Object.is(roundMove(-0.04), 0)).toBe(true);
    expect(roundMove(-0.005, 2)).toBe(-0.01);
  });
});

describe('the problems line', () => {
  const t = ((_key: string, options: Record<string, unknown>) =>
    `${options.share}|${options.count}`) as unknown as Parameters<typeof problemItems>[1];
  const costliest = (share: unknown) =>
    figure('dashboard.costliest-problems', {
      rows: [{ problem: 'Spindle', hours: 4, share, breakdowns: 2 }],
      totalHours: 4,
    });

  it('prints a dash, never 0.00%, for a missing share', () => {
    expect(problemItems(costliest(null), t)[0]?.display).toBe('—|2');
    expect(problemItems(costliest(undefined), t)[0]?.display).toBe('—|2');
    expect(problemItems(costliest(19.2), t)[0]?.display).toBe('19.20%|2');
  });
});
