import type { TFunction } from 'i18next';
import { BIG_HOURS, FULL, LAST_FULL, PARTIAL, S, fixed, usualRange, type Metric } from './data.js';
import { tipHtml } from './trend-tip.js';
import { tooltipBase, type Ink } from './use-echart.js';

const axisText = (metric: Metric, v: number): string =>
  `${fixed(v, metric.id === 'availability' ? 1 : 0)}${metric.unit === '%' ? ' %' : ''}`;

function axes(ink: Ink, metric: Metric) {
  const rate = metric.id === 'availability';
  return {
    xAxis: {
      type: 'category',
      data: S.months,
      boundaryGap: false,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: ink.line } },
      axisLabel: { color: ink.ink2, margin: 12 },
      axisPointer: { label: { formatter: (p: { value: string }) => p.value } },
    },
    yAxis: {
      type: 'value',
      min: rate ? (v: { min: number }) => Math.floor(v.min - 0.2) : 0,
      max: rate ? 100 : undefined,
      splitNumber: 4,
      axisLabel: { color: ink.ink2, formatter: (v: number) => axisText(metric, v) },
      splitLine: { lineStyle: { color: ink.line } },
      axisPointer: { label: { show: false } },
    },
  };
}

/** The usual-range band and the markers for a month with a breakdown of a day or more, both riding on the main line. */
function marks(ink: Ink, metric: Metric, t: TFunction) {
  const [lo, hi] = usualRange(metric);
  const big = S.detail.flatMap((d, i) =>
    d.longest && d.longest.hours >= BIG_HOURS && metric.values[i] != null
      ? [{ coord: [i, metric.values[i]] }]
      : [],
  );
  return {
    markArea: {
      silent: true,
      itemStyle: { color: ink.accentTint, opacity: 0.55 },
      label: {
        show: true,
        position: 'insideTopLeft',
        color: ink.ink2,
        fontSize: 11,
        formatter: t('trend.range'),
      },
      data: [[{ yAxis: lo }, { yAxis: hi }]],
    },
    markPoint: {
      silent: true,
      symbol: 'diamond',
      symbolSize: 10,
      itemStyle: { color: ink.ink, borderColor: ink.surface, borderWidth: 1.5 },
      label: { show: false },
      data: big,
    },
  };
}

function series(ink: Ink, metric: Metric, t: TFunction) {
  const part = (from: number, to: number) =>
    metric.values.map((v, i) => (i >= from && i <= to ? v : null));
  const line = { type: 'line' as const, symbol: 'circle', symbolSize: 8, showSymbol: false, z: 3 };
  const fade = {
    type: 'linear',
    x: 0,
    y: 0,
    x2: 0,
    y2: 1,
    colorStops: [
      { offset: 0, color: `${ink.accent}29` },
      { offset: 1, color: `${ink.accent}00` },
    ],
  };
  return [
    {
      ...line,
      id: 'full',
      data: part(0, FULL - 1),
      lineStyle: { width: 2.5, color: ink.accent, cap: 'round', join: 'round' },
      itemStyle: { color: ink.accent, borderColor: ink.surface, borderWidth: 2 },
      areaStyle: { color: fade },
      ...marks(ink, metric, t),
    },
    {
      ...line,
      id: 'partial',
      data: PARTIAL ? part(LAST_FULL, FULL) : [],
      lineStyle: { width: 2.5, color: ink.accent, type: [4, 4], cap: 'round' },
      itemStyle: { color: ink.surface, borderColor: ink.accent, borderWidth: 2 },
      tooltip: { show: false },
    },
  ];
}

/** A quiet range slider under the plot: a thin track, a tinted window and two small handles. */
function zoom(ink: Ink) {
  return [
    {
      type: 'slider',
      height: 14,
      bottom: 6,
      showDetail: false,
      brushSelect: false,
      borderColor: 'transparent',
      backgroundColor: `${ink.ink}0d`,
      fillerColor: `${ink.accent}26`,
      handleSize: '110%',
      handleStyle: { color: ink.surface, borderColor: ink.accent, borderWidth: 1.5 },
      moveHandleSize: 0,
      dataBackground: { lineStyle: { color: ink.line }, areaStyle: { color: 'transparent' } },
      selectedDataBackground: {
        lineStyle: { color: ink.accent },
        areaStyle: { color: 'transparent' },
      },
      textStyle: { color: ink.ink2 },
    },
  ];
}

/** The trend's whole ECharts option for one metric. */
export function trendOption(ink: Ink, metric: Metric, t: TFunction) {
  return {
    textStyle: { fontFamily: ink.font, color: ink.ink2, fontSize: 12 },
    grid: { left: 4, right: 14, top: 18, bottom: 54, containLabel: true },
    ...axes(ink, metric),
    series: series(ink, metric, t),
    dataZoom: zoom(ink),
    tooltip: tooltipBase(
      ink,
      {
        type: 'cross',
        snap: true,
        lineStyle: { color: ink.ink2, type: 'dashed', width: 1 },
        crossStyle: { color: ink.ink2, type: 'dashed', width: 1 },
        label: {
          backgroundColor: ink.ink,
          color: ink.surface,
          fontSize: 11,
          padding: [3, 7],
          borderRadius: 4,
        },
      },
      (index) => tipHtml(t, metric, index),
    ),
  };
}
