import { useState, type CSSProperties, type KeyboardEvent } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { instrument } from '../directions/direction-instrument.js';
import { inkOn } from '../directions/parts-palette.js';
import { S, fixed, monthLong } from './data.js';
import { pointed, type Hover } from './trend-chart.js';

const RAMP = instrument.light.seq;
const MOST = Math.max(...S.heat.flatMap((r) => r.hours));
const TOP = S.heat
  .flatMap((r) => r.hours.map((hours, month) => ({ id: r.id, hours, month })))
  .sort((a, b) => b.hours - a.hours)[0]!;

/** The ramp step of a square: fifths of the square root, so a month of 20 hours still shows beside one of 240. */
const stepOf = (hours: number): number =>
  hours <= 0 ? 0 : Math.min(5, Math.max(1, Math.ceil(Math.sqrt(hours / MOST) * 5)));

const cellText = (hours: number): string => (hours <= 0 ? '' : fixed(hours, hours < 10 ? 1 : 0));

/** One square: its hours printed on its step of the ramp, lit when its month is the one pointed at; focus works like hover. */
function Square({
  hours,
  row,
  month,
  on,
  tab,
  onPoint,
  onClear,
}: {
  hours: number;
  row: number;
  month: number;
  on: boolean;
  tab: boolean;
  onPoint: () => void;
  onClear: () => void;
}) {
  const step = stepOf(hours);
  const fill = step > 0 ? { background: RAMP[step - 1], color: inkOn(RAMP[step - 1]!) } : {};
  return (
    <td
      data-on={on ? '' : undefined}
      data-r={row}
      data-c={month}
      tabIndex={tab ? 0 : -1}
      style={{ '--col': month, ...fill } as unknown as CSSProperties}
      onMouseEnter={onPoint}
      onFocus={onPoint}
      onBlur={onClear}
    >
      {hours > 0 ? cellText(hours) : <span className="sr-only">0</span>}
    </td>
  );
}

const STEP: Record<string, [number, number]> = {
  ArrowRight: [0, 1],
  ArrowLeft: [0, -1],
  ArrowDown: [1, 0],
  ArrowUp: [-1, 0],
};

/** Arrow keys move between squares (one tab stop for the whole grid). */
function moveFocus(e: KeyboardEvent<HTMLTableElement>): void {
  const td = (e.target as HTMLElement).closest('td');
  const step = STEP[e.key];
  if (!td || !step) return;
  e.preventDefault();
  const r = Number(td.dataset.r) + step[0];
  const c = Number(td.dataset.c) + step[1];
  e.currentTarget.querySelector<HTMLElement>(`td[data-r="${r}"][data-c="${c}"]`)?.focus();
}

function HeadRow({ active }: { active: number | null }) {
  const { t } = useTranslation('showcase');
  return (
    <thead>
      <tr>
        <th scope="col" className="sr-only">
          {t('heat.machine')}
        </th>
        {S.months.map((m, i) => (
          <th key={m} scope="col" data-on={active === i ? '' : undefined}>
            <span aria-hidden="true">{m.slice(0, 3)}</span>
            <span className="sr-only">{monthLong(i)}</span>
          </th>
        ))}
      </tr>
    </thead>
  );
}

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

function RampKey() {
  const { t } = useTranslation('showcase');
  return (
    <div className="sc-ramp" aria-hidden="true">
      <span>{t('heat.less')}</span>
      {RAMP.map((colour) => (
        <i key={colour} style={{ background: colour }} />
      ))}
      <span>{t('heat.more')}</span>
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
 * Machines by month on the sequential ramp, as a real table so every square keeps its number and a screen reader
 * gets rows and columns. A month pointed at on the trend lights its column; a cause pointed at on the Pareto
 * lights the machines it is made of; pointing at a square tells the trend (`onHover`).
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
  const [cur, setCur] = useState('0-0');
  const point = (id: string, month: number) => {
    setCell({ id, month });
    onHover(pointed(month));
  };
  const clear = () => {
    setCell(null);
    onHover(pointed(null));
  };
  const readout = readoutOf(t, cell, machines);
  return (
    <section className="sc-card" aria-labelledby="sc-heat-title">
      <HeatHead />
      <table className="sc-heat" data-testid="heat-map" onMouseLeave={clear} onKeyDown={moveFocus}>
        <caption className="sr-only">{t('heat.caption')}</caption>
        <colgroup>
          <col className="sc-heat-name" />
        </colgroup>
        <HeadRow active={hover.month} />
        <tbody>
          {S.heat.map((row, r) => (
            <tr key={row.id} data-link={machines.includes(row.id) ? '' : undefined}>
              <th scope="row">{row.id}</th>
              {row.hours.map((hours, i) => (
                <Square
                  key={i}
                  hours={hours}
                  row={r}
                  month={i}
                  on={hover.month === i}
                  tab={cur === `${r}-${i}`}
                  onPoint={() => {
                    setCur(`${r}-${i}`);
                    point(row.id, i);
                  }}
                  onClear={clear}
                />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="sc-note sc-readout" aria-live="polite">
        {readout}
      </p>
      <RampKey />
    </section>
  );
}
