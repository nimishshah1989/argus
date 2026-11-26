import { DEFAULT_PROFILE } from '@uptimo/shared';
import { describe, expect, it } from 'vitest';
import { FIGURES, run, type FigureResult } from '../src/index.js';
import { ENGINE_DATA } from './answer-key/fixture.js';
import { COSMOS_FROM, HISTORY, withFrom } from './history-fixture.js';

/**
 * Ticket 621, ADR 0027, goal G3.3, as ADR 0063 changed it: loading 2022–2025 history beside the 2026 data moves no
 * headline figure. With the plant's data-from date set to 2026-01-01 and no span named, every figure but the ones that
 * learn from history equals the 2026-only run, value and drill, once the two trend series are set aside. Those trends
 * and the history figures now read the older years on purpose.
 */

const AS_OF = '2026-11-11';
const LEARNS = new Set(FIGURES.filter((f) => f.reads === 'history').map((f) => f.key));
const TRENDS = new Set(['ch-a1-trend', 'ch-a3-planttrend', 'ch-rp-12m', 'ch-ry-month']);

type Page = { charts?: { id: string; labels: string[] }[] };
const pagesOf = (figure: FigureResult | undefined): Page[] =>
  ((figure?.value as { pages?: Page[] } | null)?.pages ?? []) as Page[];

/** A figure with its trend series left out: what the 2026 answer key still pins. */
function headline(figure: FigureResult): FigureResult {
  const pages = pagesOf(figure);
  if (pages.length === 0) return figure;
  const value = figure.value as Record<string, unknown>;
  const kept = pages.map((page) => ({
    ...page,
    charts: page.charts?.filter((chart) => !TRENDS.has(chart.id)),
  }));
  return { ...figure, value: { ...value, pages: kept } as unknown as FigureResult['value'] };
}

const alone = run(ENGINE_DATA, AS_OF, DEFAULT_PROFILE);
const loaded = run(withFrom(HISTORY, COSMOS_FROM), AS_OF, DEFAULT_PROFILE);
const byKey = (key: string) => loaded.figures.find((figure) => figure.key === key);
const trend = (key: string, id: string) =>
  pagesOf(byKey(key))[0]?.charts?.find((chart) => chart.id === id);

describe('history parity (data-from date)', () => {
  it('the history copy really holds older years (so the test can fail)', () => {
    expect(HISTORY.tickets.length).toBe(ENGINE_DATA.tickets.length * 3);
    expect(HISTORY.reports.some((r) => r.date.startsWith('2022-'))).toBe(true);
  });

  it('with dataFrom 2026-01-01, 2024 and 2022 history moves no headline figure', () => {
    const headlines = (figures: FigureResult[]) =>
      figures.filter((figure) => !LEARNS.has(figure.key)).map(headline);
    expect(headlines(loaded.figures)).toEqual(headlines(alone.figures));
  });

  it('the figures that learn from history read the older years (ADR 0063)', () => {
    const older = (key: string) => byKey(key)?.drill.ids.filter((id) => id.startsWith('h2024-'));
    expect(older('fix-finder')?.length).toBeGreaterThan(0);
    const changed = [...LEARNS].filter(
      (key) =>
        JSON.stringify(byKey(key)) !==
        JSON.stringify(alone.figures.find((figure) => figure.key === key)),
    );
    expect(changed).toEqual(expect.arrayContaining(['a9-bottleneck-forecast', 'fix-finder']));
  });

  it('the trend series run from the first recorded year, the 2026 run from January', () => {
    expect(trend('a1-bd-pm', 'ch-a1-trend')?.labels[0]).toBe('Jan 22');
    expect(trend('a3-mttr-mtbf', 'ch-a3-planttrend')?.labels.at(-1)).toBe('Dec 26');
    const own = pagesOf(alone.figures.find((f) => f.key === 'a1-bd-pm'))[0]?.charts;
    expect(own?.find((chart) => chart.id === 'ch-a1-trend')?.labels[0]).toBe('Jan');
  });

  it('the reports month charts run over every recorded year, their tables on their own period (ADR 0064)', () => {
    expect(trend('monthly-report', 'ch-rp-12m')?.labels[0]).toBe('Jan 22');
    expect(trend('monthly-report', 'ch-rp-12m')?.labels.at(-1)).toBe('Oct 26');
    expect(trend('annual-report', 'ch-ry-month')?.labels[0]).toBe('Jan 22');
    expect(trend('annual-report', 'ch-ry-month')?.labels.at(-1)).toBe('Nov 26');
    const own = pagesOf(alone.figures.find((f) => f.key === 'annual-report'))[0]?.charts;
    expect(own?.find((chart) => chart.id === 'ch-ry-month')?.labels[0]).toBe('Jan');
  });

  it('the run names every recorded year, before the data-from cut', () => {
    expect(loaded.years).toEqual([2022, 2024, 2026]);
    expect(alone.years).toEqual([2026]);
  });
});
