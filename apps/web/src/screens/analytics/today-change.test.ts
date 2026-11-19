import { describe, expect, it } from 'vitest';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { toneOfChange } from '../../ui/meaning/index.js';
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
