import { useState, type CSSProperties, type KeyboardEvent } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { instrument } from '../directions/direction-instrument.js';
import type { Theme } from '../directions/direction-props.js';
import { FAMILY_COLOURS } from '../directions/family-colours.js';
import { inkOn } from '../directions/parts-palette.js';
import { S, fixed, monthLong } from './data.js';
import { Tag, TagGlyph, riskTag, type TagSpec } from './tags.js';
import { useTheme } from './theme.js';
import { pointed, type Hover } from './trend-chart.js';

/** Share of the downtime family's fill at each of the five steps; the rest is the card's own surface. */
const SHARE = [0.14, 0.32, 0.52, 0.72, 0.92];

const channel = (hex: string, i: number): number => parseInt(hex.slice(i, i + 2), 16);
const mix = (from: string, to: string, share: number): string =>
  `#${[1, 3, 5]
    .map((i) =>
      Math.round(channel(from, i) * (1 - share) + channel(to, i) * share)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;

/** The heat map's ramp: the downtime family's ink (orange) thinned into the surface, so hours read as the colour of lost time. */
export const rampOf = (theme: Theme): string[] => {
  const surface = instrument[theme].surface;
  return SHARE.map((share) => mix(surface, FAMILY_COLOURS[theme].downtime.fill, share));
};
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
  ramp,
  hours,
  row,
  month,
  on,
  tab,
  onPoint,
  onClear,
}: {
  ramp: string[];
  hours: number;
  row: number;
  month: number;
  on: boolean;
  tab: boolean;
  onPoint: () => void;
  onClear: () => void;
}) {
  const step = stepOf(hours);
  const fill = step > 0 ? { background: ramp[step - 1], color: inkOn(ramp[step - 1]!) } : {};
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

function RampKey({ ramp }: { ramp: string[] }) {
  const { t } = useTranslation('showcase');
  return (
    <div className="sc-ramp" aria-hidden="true">
      <span>{t('heat.less')}</span>
      {ramp.map((colour) => (
        <i key={colour} style={{ background: colour }} />
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

/** A machine's name with its risk icon (the word is there for a screen reader and in the list below the grid). */
function RowHead({ id, hours }: { id: string; hours: number[] }) {
  const { t } = useTranslation('showcase');
  const risk = riskTag(t, hours);
  return (
    <th scope="row">
      {id}
      {risk ? <TagGlyph tag={risk} /> : null}
    </th>
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

/** The body of the grid: a row per machine, a square per month. */
function HeatBody({
  hover,
  machines,
  ramp,
  point,
  clear,
}: {
  hover: Hover;
  machines: string[];
  ramp: string[];
  point: (id: string, month: number) => void;
  clear: () => void;
}) {
  const [cur, setCur] = useState('0-0');
  return (
    <tbody>
      {S.heat.map((row, r) => (
        <tr key={row.id} data-link={machines.includes(row.id) ? '' : undefined}>
          <RowHead id={row.id} hours={row.hours} />
          {row.hours.map((hours, i) => (
            <Square
              ramp={ramp}
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
  );
}

/**
 * Machines by month on a ramp of the downtime colour, as a real table so every square keeps its number and a
 * screen reader gets rows and columns. A month pointed at on the trend lights its column; a cause pointed at on
 * the Pareto lights the machines it is made of; pointing at a square tells the trend (`onHover`).
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
  const point = (id: string, month: number) => {
    setCell({ id, month });
    onHover(pointed(month));
  };
  const clear = () => {
    setCell(null);
    onHover(pointed(null));
  };
  const ramp = rampOf(useTheme());
  return (
    <section className="sc-card" data-family="downtime" aria-labelledby="sc-heat-title">
      <HeatHead />
      <table className="sc-heat" data-testid="heat-map" onMouseLeave={clear} onKeyDown={moveFocus}>
        <caption className="sr-only">{t('heat.caption')}</caption>
        <colgroup>
          <col className="sc-heat-name" />
        </colgroup>
        <HeadRow active={hover.month} />
        <HeatBody hover={hover} machines={machines} ramp={ramp} point={point} clear={clear} />
      </table>
      <p className="sc-note sc-readout" aria-live="polite">
        {readoutOf(t, cell, machines)}
      </p>
      <RampKey ramp={ramp} />
      <RiskList />
    </section>
  );
}
