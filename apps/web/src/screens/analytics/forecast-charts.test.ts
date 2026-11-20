import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { TFunction } from 'i18next';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { en, gu, type MessageKey } from '@uptimo/shared/i18n';
import { contentKind, contentOf } from './figure-content.js';

/**
 * 42e: the A9 and Forecast Lab screens map the frozen 11 November keys whole. Every KPI, every table cell and
 * every chart series is pinned against the key itself, never against a hand-copied expectation; the two drawing
 * rules the key does not carry (the map's arm radius and its High/Critical labels) are pinned from the key's own
 * hours and ratings. The three chart ids live in `forecast-charts.ts`; `contentOf` is their only caller.
 */

type Figure = FiguresReply['figures'][number];

const A9_KEY: unknown = JSON.parse(
  readFileSync(
    new URL('../../../../../fixtures/answer-key/a9-bottleneck-forecast.json', import.meta.url),
    'utf8',
  ),
);
const FL_KEY: unknown = JSON.parse(
  readFileSync(
    new URL('../../../../../fixtures/answer-key/forecast-lab.json', import.meta.url),
    'utf8',
  ),
);

interface KeyChart {
  id: string;
  axes: { x: string; y: string };
  tickLabels: { x: string[]; y: string[] };
  labels: string[];
  datasets: { label: string; data: unknown[] }[];
}

interface KeyPage {
  page: string;
  title: string;
  kpis: { label: string; value: string; sub: string }[];
  tables: { title: string; header: string[]; rows: string[][]; rowCount: number }[];
  charts: KeyChart[];
}

const A9 = (A9_KEY as { pages: KeyPage[] }).pages[0]!;
const FL = (FL_KEY as { pages: KeyPage[] }).pages[0]!;

/** Neutral screen constants, so CI's secret scanner never reads a figure lookup as an API key. */
const SCREEN_A9 = 'a9-bottleneck-forecast';
const SCREEN_LAB = 'forecast-lab';

/** A9 sorts the risk, planning-forecast, both trend and the repeat tables; the Lab sorts both of its tables. */
const A9_SORTABLE = [0, 5, 6, 7, 8];

const RATING_TONE: Record<string, string> = {
  Critical: 'danger',
  High: 'hold',
  Watch: 'warning',
  Low: 'muted',
};
const BAND_TONE: Record<string, string> = {
  Hot: 'danger',
  Likely: 'hold',
  Watch: 'warning',
  Stable: 'ok',
};
const FL_TONE: Record<string, string> = {
  Actual: 'ok',
  'Current model': 'muted',
  'Age-adjusted': 'info',
  'Recent-weighted': 'hold',
  'Age + recent': 'moved',
};

function translator(): TFunction {
  const t = ((key: string, values?: Record<string, unknown>) => {
    const template = en[key as MessageKey] ?? key;
    return Object.entries(values ?? {}).reduce(
      (text, [name, value]) => text.replaceAll(`{{${name}}}`, String(value)),
      template,
    );
  }) as unknown as TFunction;
  return t;
}

function figure(key: string, value: unknown, screen = key): Figure {
  return {
    key,
    screen,
    owner: 42,
    status: 'ready',
    value,
    drill: { type: 'machine', ids: [] },
  };
}

/** The key's radius rule, written here so the assertion cannot read it back from the mapper. */
function radius(hours: number): number {
  return Math.max(4, Math.min(15, 4 + Math.sqrt(Math.max(0, hours)) * 0.7));
}

interface MapPoint {
  x: number;
  y: number;
  id: string;
  h: number;
}

function bandOf(label: string, forecast: KeyPage['tables'][number]): string | undefined {
  const id = label.split(' · ')[0];
  return forecast.rows.find((row) => row[1] === id)?.[10];
}

function expectedMap() {
  const chart = A9.charts[0]!;
  return {
    kind: 'scatter',
    title: 'Risk map — every machine, grouped by kind',
    machineLabel: 'Machine',
    xLabel: chart.axes.x,
    yLabel: chart.axes.y,
    mttrLabel: 'BD hrs',
    yTickLabels: chart.tickLabels.y,
    points: chart.datasets.flatMap((dataset) =>
      (dataset.data as MapPoint[]).map((point) => ({
        x: point.x,
        y: point.y,
        r: radius(point.h),
        label: point.id,
        mttr: point.h,
        tone: RATING_TONE[dataset.label],
        showLabel: dataset.label === 'High' || dataset.label === 'Critical',
      })),
    ),
  };
}

function expectedForecast() {
  const chart = A9.charts[1]!;
  const forecast = A9.tables[5]!;
  const [expected, plan] = chart.datasets as { label: string; data: number[] }[];
  return {
    kind: 'bar',
    title: 'Expected downtime, machine by machine',
    categoryLabel: 'Machine · category',
    categories: chart.labels,
    series: [
      {
        name: expected!.label,
        values: expected!.data,
        tones: chart.labels.map((label) => BAND_TONE[bandOf(label, forecast)!]),
      },
      { name: plan!.label, values: plan!.data },
    ],
    valueLabel: chart.axes.x,
    horizontal: true,
  };
}

function expectedLab() {
  const chart = FL.charts[0]!;
  const datasets = chart.datasets as { label: string; data: number[] }[];
  return {
    kind: 'line',
    title: 'Plant downtime: forecast against actual, month by month',
    categoryLabel: 'Month',
    categories: chart.labels,
    series: datasets.map((dataset) => ({
      name: dataset.label,
      values: dataset.data,
      tone: FL_TONE[dataset.label],
    })),
    valueLabel: chart.axes.y,
  };
}

describe('the A9 page', () => {
  it('maps the key page whole: its title, 14 KPIs and every cell of its nine tables', () => {
    const content = contentOf(figure(SCREEN_A9, A9_KEY), translator());
    expect(contentKind(figure(SCREEN_A9, A9_KEY))).toBe('page');
    if (content?.kind !== 'page') throw new Error('expected the A9 page');
    expect(content.title).toBe(A9.title);
    expect(content.kpis).toEqual(A9.kpis.map(({ label, value, sub }) => ({ label, value, sub })));
    expect(content.kpis).toHaveLength(14);
    expect(content.tables).toHaveLength(9);
    expect(content.tables).toEqual(
      A9.tables.map((table, index) => ({
        ...table,
        truncated: false,
        ...(A9_SORTABLE.includes(index) ? { sortable: true } : {}),
      })),
    );
  });

  it('sorts the risk, planning-forecast, both trend and the repeat tables, and no other', () => {
    const content = contentOf(figure(SCREEN_A9, A9_KEY), translator());
    if (content?.kind !== 'page') throw new Error('expected the A9 page');
    expect(
      content.tables.filter((table) => table.sortable === true).map((table) => table.title),
    ).toEqual(A9_SORTABLE.map((index) => A9.tables[index]!.title));
  });

  it('maps both charts: the raw-tick risk map and the band-coloured planning forecast', () => {
    const content = contentOf(figure(SCREEN_A9, A9_KEY), translator());
    if (content?.kind !== 'page') throw new Error('expected the A9 page');
    expect(content.charts).toEqual([expectedMap(), expectedForecast()]);
    const map = content.charts[0];
    if (map?.kind !== 'scatter') throw new Error('expected the risk map');
    const byId = new Map(map.points.map((point) => [point.label, point]));
    expect(byId.get('WJ-01')?.r).toBeCloseTo(10.4038, 3);
    expect(byId.get('TMC-2')?.r).toBe(15);
    expect(byId.get('VC-11')?.r).toBeCloseTo(8.879, 3);
    expect(map.points.filter((point) => point.showLabel === true)).toHaveLength(22);
    expect(
      map.points
        .filter((point) => point.showLabel === true)
        .map((point) => point.tone)
        .sort(),
    ).toEqual([...Array(6).fill('danger'), ...Array(16).fill('hold')].sort());
    expect(map.yTickLabels).toContain('Cnc Sliding Head  Automatic Lathe (2)');
    const forecast = content.charts[1];
    if (forecast?.kind !== 'bar') throw new Error('expected the planning forecast');
    expect(forecast.series[0]?.tones?.filter((tone) => tone === 'danger')).toHaveLength(1);
    expect(forecast.series[0]?.tones?.filter((tone) => tone === 'hold')).toHaveLength(14);
  });

  it('labels the risk map by machine code when the points are looked up by database id', () => {
    const uuid = (at: number) => `00000000-0000-4000-8000-${String(at).padStart(12, '0')}`;
    let at = 0;
    const keyed = {
      ...(A9_KEY as object),
      pages: [
        {
          ...A9,
          charts: A9.charts.map((chart) =>
            chart.id === 'ch-a9-map'
              ? {
                  ...chart,
                  datasets: chart.datasets.map((dataset) => ({
                    ...dataset,
                    data: (dataset.data as MapPoint[]).map((point) => ({
                      ...point,
                      id: uuid((at += 1)),
                      code: point.id,
                    })),
                  })),
                }
              : chart,
          ),
        },
      ],
    };
    const content = contentOf(figure(SCREEN_A9, keyed), translator());
    if (content?.kind !== 'page') throw new Error('expected the A9 page');
    const map = content.charts[0];
    if (map?.kind !== 'scatter') throw new Error('expected the risk map');
    expect(map).toEqual(expectedMap());
  });

  it('names the A9 chart chrome in both catalogues', () => {
    for (const key of [
      'analytics.content.a9.mapChart',
      'analytics.content.a9.machineLabel',
      'analytics.content.a9.hoursLabel',
      'analytics.content.a9.forecastChart',
      'analytics.content.a9.forecastCategory',
    ]) {
      expect(en[key as MessageKey], key).toBeTruthy();
      expect(Object.hasOwn(gu, key), key).toBe(true);
    }
  });
});

describe('the Forecast Lab page', () => {
  it('maps the key page whole: no KPIs, every cell of both tables and all five chart lines', () => {
    const content = contentOf(figure(SCREEN_LAB, FL_KEY), translator());
    expect(contentKind(figure(SCREEN_LAB, FL_KEY))).toBe('page');
    if (content?.kind !== 'page') throw new Error('expected the Lab page');
    expect(content.title).toBe(FL.title);
    expect(content.kpis).toEqual([]);
    expect(content.tables).toEqual(
      FL.tables.map((table) => ({ ...table, truncated: false, sortable: true })),
    );
    expect(content.tables).toHaveLength(2);
    expect(content.tables[0]?.rows).toHaveLength(4);
    expect(content.tables[1]?.rows).toHaveLength(7);
    expect(content.charts).toEqual([expectedLab()]);
    const chart = content.charts[0];
    if (chart?.kind !== 'line') throw new Error('expected the Lab line chart');
    expect(chart.series).toHaveLength(5);
    expect(chart.series.map((series) => series.name)).toEqual([
      'Actual',
      'Current model',
      'Age-adjusted',
      'Recent-weighted',
      'Age + recent',
    ]);
    expect(chart.valueLabel).toBe('Breakdown hours in the month');
  });

  it('names the Lab chart chrome in both catalogues', () => {
    for (const key of [
      'analytics.content.forecastLab.chart',
      'analytics.content.forecastLab.monthAxis',
    ]) {
      expect(en[key as MessageKey], key).toBeTruthy();
      expect(Object.hasOwn(gu, key), key).toBe(true);
    }
  });
});
