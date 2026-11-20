import { useLayoutEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { directionProps } from '../directions/direction-props.js';
import { instrument } from '../directions/direction-instrument.js';
import { AS_OF_TEXT, FULL, METRICS, PARTIAL, monthLong, type Metric } from './data.js';
import { CellPanel } from './cell-panel.js';
import { HeatMap } from './heat-map.js';
import { KpiSheet } from './kpi-sheet.js';
import { KpiTile } from './kpi-tile.js';
import { ParetoChart } from './pareto-chart.js';
import { TrendChart, type Hover } from './trend-chart.js';
import { figure } from '../directions/figures.js';
import { useTheme } from './theme.js';
import './strings.js';
import './showcase.css';
import './showcase-grids.css';
import './showcase-overlay.css';
import './showcase-tags.css';

/**
 * `/gallery?view=showcase` (ticket 80t): the analytics overview at production quality, the reference the page
 * templates copy. White canvas, Instrument's tokens, six figures with their months, four charts that point at each
 * other, and a side sheet that explains any figure. Every number comes from the engine's snapshot.
 */
export default function Showcase() {
  const { t } = useTranslation('showcase');
  const theme = useTheme();
  const props = useMemo(() => directionProps(instrument, theme), [theme]);
  // On <html>, not on the root, so the sheet (a portal) and the chart tooltips inherit the same tokens.
  useLayoutEffect(() => {
    const style = document.documentElement.style;
    for (const [name, value] of Object.entries(props)) style.setProperty(name, value);
    style.colorScheme = theme;
    return () => {
      Object.keys(props).forEach((name) => style.removeProperty(name));
      style.removeProperty('color-scheme');
    };
  }, [props, theme]);
  const [hover, setHover] = useState<Hover>({ month: null, from: 'other' });
  const [machines, setMachines] = useState<string[]>([]);
  const [sheet, setSheet] = useState<{ metric: Metric | null; open: boolean }>({
    metric: null,
    open: false,
  });
  return (
    <div className="sc" data-testid="showcase" data-theme={theme}>
      <main className="sc-page">
        <header className="sc-header">
          <div>
            <h1>{t('title')}</h1>
            <p className="sc-plant">
              {t('plant')} · {t('machines', { n: figure<number>('dashboard.total-machines') })} ·{' '}
              {t('period', { date: AS_OF_TEXT })}
            </p>
          </div>
          <p className="sc-updated">{t('updated', { date: AS_OF_TEXT })}</p>
        </header>
        <ul className="sc-tiles">
          {METRICS.map((m) => (
            <li key={m.id}>
              <KpiTile
                metric={m}
                active={hover.month}
                onOpen={(metric) => setSheet({ metric, open: true })}
              />
            </li>
          ))}
        </ul>
        {PARTIAL ? <p className="sc-note">{t('inProgress', { month: monthLong(FULL) })}</p> : null}
        <TrendChart hover={hover} onHover={setHover} />
        <div className="sc-pair">
          <ParetoChart onCause={setMachines} />
          <HeatMap hover={hover} onHover={setHover} machines={machines} />
        </div>
        <CellPanel hover={hover} />
      </main>
      <KpiSheet
        metric={sheet.metric}
        open={sheet.open}
        onClose={() => setSheet((s) => ({ ...s, open: false }))}
      />
    </div>
  );
}
