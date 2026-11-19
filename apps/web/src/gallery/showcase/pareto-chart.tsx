import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { S, fixed } from './data.js';
import { NARROW, tooltipBase, useEchart, type Ink } from './use-echart.js';

const CAUSES = S.causes;
/** Running share of all breakdown hours after each cause, as a percent. */
let running = 0;
const CUM = CAUSES.map((c) => ((running += c.hours) / S.totalHours) * 100);
const REACH = CUM.findIndex((v) => v >= 80);
/** How many causes it takes to pass 80 % (all of them when the list stops short). */
const VITAL = REACH === -1 ? CAUSES.length : REACH + 1;

const esc = (text: string): string => text.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

function tip(t: TFunction, i: number): string {
  const c = CAUSES[i]!;
  const share = (c.hours / S.totalHours) * 100;
  const machines = c.machines
    .map((m) => `<li><span>${esc(m.id)}</span><b>${fixed(m.hours, 1)} h</b></li>`)
    .join('');
  return `<div class="sc-tip"><header>${esc(c.name)}</header><p class="sc-tip-value"><b>${fixed(c.hours, 1)}</b> <i>h</i> <span class="sc-tip-sub">${fixed(share, 1)} %</span></p><dl><dt>${esc(t('pareto.cum'))}</dt><dd>${fixed(CUM[i], 1)} %</dd><dt>${esc(t('tip.breakdowns'))}</dt><dd>${fixed(c.breakdowns, 0)}</dd></dl><p class="sc-tip-sub">${esc(t('pareto.machines'))}</p><ul class="sc-tip-list">${machines}</ul></div>`;
}

function axes(ink: Ink) {
  const narrow = ink.width < NARROW;
  return {
    yAxis: {
      type: 'category',
      inverse: true,
      data: CAUSES.map((c) => c.name),
      axisTick: { show: false },
      axisLine: { show: false },
      axisLabel: { color: ink.ink, width: narrow ? 124 : 220, overflow: 'truncate', margin: 10 },
    },
    xAxis: [
      {
        type: 'value',
        position: 'bottom',
        splitNumber: narrow ? 2 : 5,
        axisLabel: { color: ink.ink2, formatter: (v: number) => `${fixed(v, 0)} h` },
        splitLine: { lineStyle: { color: ink.line } },
      },
      {
        type: 'value',
        min: 0,
        max: 100,
        interval: narrow ? 50 : 20,
        position: 'top',
        axisLabel: { color: ink.ink2, formatter: '{value} %' },
        splitLine: { show: false },
      },
    ],
  };
}

function series(ink: Ink) {
  return [
    {
      id: 'hours',
      type: 'bar',
      xAxisIndex: 0,
      barWidth: '56%',
      data: CAUSES.map((c, i) => ({
        value: c.hours,
        itemStyle: {
          color: i < VITAL ? ink.accent : `${ink.accent}59`,
          borderRadius: [0, 4, 4, 0],
        },
      })),
      emphasis: { itemStyle: { color: ink.accent } },
    },
    {
      id: 'cumulative',
      type: 'line',
      xAxisIndex: 1,
      symbol: 'circle',
      symbolSize: 6,
      data: CUM.map((v) => Math.round(v * 10) / 10),
      lineStyle: { width: 2, color: ink.ink2 },
      itemStyle: { color: ink.surface, borderColor: ink.ink2, borderWidth: 1.5 },
      z: 4,
      markLine: {
        silent: true,
        symbol: 'none',
        label: { show: false },
        animation: false,
        lineStyle: { color: ink.ink, type: [4, 4], width: 1 },
        data: [{ xAxis: 80 }],
      },
    },
  ];
}

function paretoOption(ink: Ink, t: TFunction) {
  return {
    textStyle: { fontFamily: ink.font, color: ink.ink2, fontSize: 12 },
    grid: { left: 4, right: 16, top: 30, bottom: 4, containLabel: true },
    ...axes(ink),
    series: series(ink),
    tooltip: tooltipBase(ink, { type: 'shadow', shadowStyle: { color: `${ink.ink}0d` } }, (i) =>
      tip(t, i),
    ),
  };
}

/**
 * Downtime by cause: hours as bars and the running share as a line, with the 80 % mark. The causes that carry the
 * first 80 % are drawn solid and the long tail pale. Pointing at a bar lists the machines it is made of, and tells
 * the heat map which of them to light (`onCause`).
 */
export function ParetoChart({ onCause }: { onCause: (machines: string[]) => void }) {
  const { t, i18n } = useTranslation('showcase');
  const { ref } = useEchart(
    (ink) => paretoOption(ink, t),
    [i18n.language],
    (chart) => {
      chart.on('updateAxisPointer', (e: unknown) => {
        const axes = (e as { axesInfo?: { axisDim: string; value: number | string }[] }).axesInfo;
        const at = axes?.find((a) => a.axisDim === 'y')?.value;
        const own = typeof at === 'number' ? CAUSES[at] : CAUSES.find((c) => c.name === at);
        onCause(own ? own.machines.map((m) => m.id) : []);
      });
      chart.on('globalout', () => onCause([]));
    },
  );
  return (
    <section className="sc-card" aria-labelledby="sc-pareto-title">
      <header className="sc-card-head">
        <div>
          <h2 id="sc-pareto-title">{t('pareto.title')}</h2>
          <p className="sc-sum">{t('pareto.sum', { n: VITAL, pct: fixed(CUM[VITAL - 1], 0) })}</p>
        </div>
      </header>
      <ul className="sc-key">
        <li>
          <span className="sc-key-bar" />
          {t('pareto.hours')}
        </li>
        <li>
          <span className="sc-key-line sc-key-grey" />
          {t('pareto.cum')}
        </li>
        <li>
          <span className="sc-key-dash" />
          {t('pareto.line')}
        </li>
      </ul>
      <div
        ref={ref}
        className="sc-chart sc-chart-pareto"
        data-testid="pareto-chart"
        role="img"
        aria-label={t('pareto.title')}
      />
      <div className="sr-only">
        <table>
          <caption>{t('pareto.table')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('pareto.cause')}</th>
              <th scope="col">{t('pareto.hours')}</th>
              <th scope="col">{t('pareto.cum')}</th>
            </tr>
          </thead>
          <tbody>
            {CAUSES.map((c, i) => (
              <tr key={c.name}>
                <th scope="row">{c.name}</th>
                <td>{fixed(c.hours, 1)}</td>
                <td>{fixed(CUM[i], 1)} %</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
