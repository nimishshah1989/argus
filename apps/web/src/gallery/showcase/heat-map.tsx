import { useState } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { HeatGrid, type HeatPoint } from '../../ui/elements/index.js';
import { S, fixed, monthLong } from './data.js';
import { Tag, TagGlyph, riskTag, type TagSpec } from './tags.js';
import { pointed, type Hover } from './trend-chart.js';

const TOP = S.heat
  .flatMap((r) => r.hours.map((hours, month) => ({ id: r.id, hours, month })))
  .sort((a, b) => b.hours - a.hours)[0]!;

/** A square prints its hours (one decimal under 10, none above); a month with none stays blank, its 0 kept for a screen reader. */
const TEST_ID = 'heat-map';
const DOWNTIME = 'downtime' as const;

const cellText = (hours: number): string => (hours <= 0 ? '' : fixed(hours, hours < 10 ? 1 : 0));

function HeatHead() {
  const { t } = useTranslation('showcase');
  return (
    <header className="sc-card-head">
      <div>
        <h2 id="sc-heat-title">{t('heat.title')}</h2>
        <p className="sc-sum">
          {t('heat.sum', {
            machine: TOP.id,
            hours: fixed(TOP.hours, 0),
            month: monthLong(TOP.month),
          })}
        </p>
      </div>
    </header>
  );
}

/** The five steps of the grid's ramp, from the same tokens the grid is shaded with. */
function RampKey() {
  const { t } = useTranslation('showcase');
  return (
    <div className="sc-ramp" aria-hidden="true">
      <span>{t('heat.less')}</span>
      {[1, 2, 3, 4, 5].map((step) => (
        <i key={step} style={{ background: `var(--color-family-downtime-ramp-${step})` }} />
      ))}
      <span>{t('heat.more')}</span>
    </div>
  );
}

/** The machines under each risk tag, with the rule in words: the row icons say which, this says what. */
function RiskList() {
  const { t } = useTranslation('showcase');
  const risks = S.heat.map((row) => riskTag(t, row.hours));
  const groups = [...new Set(risks.filter((x): x is TagSpec => x !== null).map((x) => x.word))];
  return (
    <div className="sc-risk" data-testid="heat-risk">
      <ul>
        {groups.map((word) => {
          const tag = risks.find((x) => x?.word === word)!;
          const ids = S.heat.filter((_, r) => risks[r]?.word === word).map((row) => row.id);
          return (
            <li key={word}>
              <Tag tag={tag} />
              <span>{ids.join(', ')}</span>
            </li>
          );
        })}
      </ul>
      <p className="sc-note">{t('heat.risk')}</p>
    </div>
  );
}

type Cell = { id: string; month: number } | null;

/** The line under the grid: the square pointed at, else the machines of the Pareto bar that the grid does not show, else a hint. */
function readoutOf(t: TFunction, cell: Cell, machines: string[]): string {
  const outside = machines.filter((m) => !S.heat.some((r) => r.id === m));
  if (cell) {
    const hours = S.heat.find((r) => r.id === cell.id)!.hours[cell.month];
    return `${cell.id} \u00b7 ${monthLong(cell.month)} \u00b7 ${fixed(hours, 1)} h`;
  }
  return outside.length > 0 ? t('heat.outside', { list: outside.join(', ') }) : t('heat.note');
}

/**
 * Machines by month on a ramp of the downtime colour, as a real table so every square keeps its number and a
 * screen reader gets rows and columns. A month pointed at on the trend lights its column; a cause pointed at on
 * the Pareto lights the machines it is made of; pointing at a square tells the trend (`onHover`). The grid is the
 * shared `HeatGrid` element; this file turns the showcase's numbers into its props and keeps the words around it.
 */
export function HeatMap({
  hover,
  onHover,
  machines,
}: {
  hover: Hover;
  onHover: (h: Hover) => void;
  machines: string[];
}) {
  const { t } = useTranslation('showcase');
  const [cell, setCell] = useState<Cell>(null);
  const point = (at: HeatPoint) => {
    setCell(at ? { id: S.heat[at.row]!.id, month: at.column } : null);
    onHover(pointed(at ? at.column : null));
  };
  return (
    <section className="sc-card" data-family="downtime" aria-labelledby="sc-heat-title">
      <HeatHead />
      <div className="sc-heat">
        <HeatGrid
          testId={TEST_ID}
          compact
          family={DOWNTIME}
          label={t('heat.caption')}
          rowHeader={t('heat.machine')}
          rows={S.heat.map((r) => r.id)}
          columns={S.months.map((m) => m.slice(0, 3))}
          columnNames={S.months.map((_, i) => monthLong(i))}
          values={S.heat.map((r) => r.hours)}
          format={cellText}
          link={{ onPoint: point, column: hover.month, rows: machines }}
          rowMark={(_, r) => {
            const risk = riskTag(t, S.heat[r]!.hours);
            return risk ? <TagGlyph tag={risk} /> : null;
          }}
        />
      </div>
      <p className="sc-note sc-readout" aria-live="polite">
        {readoutOf(t, cell, machines)}
      </p>
      <RampKey />
      <RiskList />
    </section>
  );
}
