import { useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { familyStep, type Family } from './family.js';
import { WRAP } from './tone.js';

/**
 * Three depths of the sequential ramp (tokens `--color-ramp-seq-1`, `-2` and `-5`). Their ink is the page ink on the
 * two light-in-light-theme steps and the surface colour on the strong one; both read 4.5:1 or better in light and
 * dark (`elements.test.ts`). The number is always printed in the cell, so depth is never the only signal.
 */
const LEVELS = [
  { ramp: 'var(--color-ramp-seq-1)', ink: 'text-neutral-900' },
  { ramp: 'var(--color-ramp-seq-2)', ink: 'text-neutral-900' },
  { ramp: 'var(--color-ramp-seq-5)', ink: 'text-surface' },
] as const;

/** Which of the three depths a value falls in, by thirds of the range; a flat grid is the lightest. */
export function heatLevel(value: number, min: number, max: number): 0 | 1 | 2 {
  if (!Number.isFinite(value) || max === min) return 0;
  const share = (value - min) / (max - min);
  return share < 1 / 3 ? 0 : share < 2 / 3 ? 1 : 2;
}

/** Which square a person points at; `null` is none. */
export type HeatPoint = { row: number; column: number } | null;

/** What makes a grid answer the pointer: the page learns which square is pointed at, and can light a column or rows. */
interface HeatLink {
  /** Told on hover and focus, and with `null` when the pointer or focus leaves. Squares then take arrow keys (one tab stop). */
  onPoint: (at: HeatPoint) => void;
  /** The column to light (the month pointed at in another chart). */
  column?: number | null;
  /** The rows to light (the machines of the cause pointed at in another chart). */
  rows?: string[];
}

const STEP: Record<string, [number, number]> = {
  ArrowRight: [0, 1],
  ArrowLeft: [0, -1],
  ArrowDown: [1, 0],
  ArrowUp: [-1, 0],
};

/** Arrow keys move between squares. */
function moveFocus(e: KeyboardEvent<HTMLTableElement>): void {
  const td = (e.target as HTMLElement).closest('td');
  const step = STEP[e.key];
  if (!td || !step) return;
  e.preventDefault();
  const r = Number(td.dataset.r) + step[0];
  const c = Number(td.dataset.c) + step[1];
  e.currentTarget.querySelector<HTMLElement>(`td[data-r="${r}"][data-c="${c}"]`)?.focus();
}

interface Scale {
  min: number;
  max: number;
  family?: Family;
  mostValue: number;
}

/** The pointer state shared by the squares: the page's link and the one square that holds the tab stop. */
type Live = HeatLink & { cur: string; setCur: (key: string) => void };

interface HeatGridProps {
  label: string;
  rows: string[];
  columns: string[];
  /** Words for a screen reader when `columns` are short forms ("Jan" for "January"). */
  columnNames?: string[];
  /** The hidden header over the row names ("Machine"). */
  rowHeader?: string;
  values: (number | undefined)[][];
  format: (value: number) => string;
  /** Shade in this family's five-step ramp (by square root of the share of the largest) instead of the neutral ramp. */
  family?: Family;
  link?: HeatLink;
  /** A small mark beside a row's name (a risk icon); its words stay in the page for a screen reader. */
  rowMark?: (row: string, at: number) => ReactNode;
  compact?: boolean;
  testId?: string;
}

/**
 * Rows by columns, each cell shaded by its value and printing it. A missing value (`undefined`) prints `—` and
 * is not shaded; a value whose `format` is empty keeps its number for a screen reader. `label` names the grid;
 * `format` prints a value with its unit. With `link` it answers the pointer and the arrow keys and can light a
 * column and rows that another chart points at; `compact` fits many columns on a phone with no sideways scroll.
 */
export function HeatGrid(props: HeatGridProps) {
  const { label, rows, columns, values, format, link } = props;
  const compact = props.compact ?? false;
  const [cur, setCur] = useState('0-0');
  if (rows.length === 0 || columns.length === 0) return null;
  const present = values.flat().filter((v): v is number => v !== undefined && Number.isFinite(v));
  const max = Math.max(...present);
  const scale: Scale = { min: Math.min(...present), max, family: props.family, mostValue: max };
  const live = link && { ...link, cur, setCur };
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={link ? undefined : 0}
      className="overflow-x-auto rounded-card"
    >
      <table
        data-testid={props.testId}
        onMouseLeave={link ? () => link.onPoint(null) : undefined}
        onKeyDown={link ? moveFocus : undefined}
        className={`w-full border-separate text-footnote ${props.compact ? 'table-fixed border-spacing-0.5' : 'border-spacing-1'}`}
      >
        <caption className="sr-only">{label}</caption>
        <HeatHead
          columns={columns}
          names={props.columnNames}
          rowHeader={props.rowHeader}
          lit={link?.column}
          compact={compact}
        />
        <tbody>
          {rows.map((row, r) => (
            <HeatRow
              key={row}
              row={row}
              at={r}
              columns={columns}
              values={values[r] ?? []}
              scale={scale}
              format={format}
              link={live}
              mark={props.rowMark?.(row, r)}
              compact={compact}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HeatHead({
  columns,
  names,
  rowHeader,
  lit,
  compact,
}: {
  columns: string[];
  names?: string[];
  rowHeader?: string;
  lit?: number | null;
  compact: boolean;
}) {
  const corner = compact ? 'w-[68px] sm:w-24' : undefined;
  const size = compact ? 'whitespace-nowrap px-0 py-1 text-caption max-sm:text-[10px]' : 'p-1';
  return (
    <thead>
      <tr>
        {rowHeader ? (
          <th scope="col" className={corner}>
            <span className="sr-only">{rowHeader}</span>
          </th>
        ) : (
          <td className={corner} />
        )}
        {columns.map((column, c) => (
          <th
            key={column}
            scope="col"
            data-on={lit === c ? '' : undefined}
            className={`text-center ${size} ${lit === c ? 'font-bold' : 'font-semibold'} ${WRAP}`}
          >
            {names ? <span aria-hidden="true">{column}</span> : column}
            {names ? <span className="sr-only">{names[c]}</span> : null}
          </th>
        ))}
      </tr>
    </thead>
  );
}

function HeatRow({
  row,
  at,
  columns,
  values,
  scale,
  format,
  link,
  mark,
  compact,
}: {
  row: string;
  at: number;
  columns: string[];
  values: (number | undefined)[];
  scale: Scale;
  format: (value: number) => string;
  link?: Live;
  mark?: ReactNode;
  compact: boolean;
}) {
  const lit = link?.rows?.includes(row) === true;
  const size = compact ? 'text-caption max-sm:text-[11px]' : '';
  return (
    <tr data-link={lit ? '' : undefined} className="group">
      <th
        scope="row"
        className={`p-1 text-left ${size} group-data-[link]:font-bold group-data-[link]:text-accent-text ${
          lit ? '' : 'font-semibold'
        } ${WRAP}`}
      >
        {row}
        {mark}
      </th>
      {columns.map((column, c) => (
        <HeatCell
          key={column}
          at={at}
          c={c}
          value={values[c]}
          scale={scale}
          format={format}
          link={link}
          compact={compact}
        />
      ))}
    </tr>
  );
}

function HeatCell({
  at,
  c,
  value,
  scale,
  format,
  link,
  compact,
}: {
  at: number;
  c: number;
  value: number | undefined;
  scale: Scale;
  format: (value: number) => string;
  link?: Live;
  compact: boolean;
}) {
  const missing = value === undefined || !Number.isFinite(value);
  const level = missing ? null : levelOf(value, scale);
  const text = missing ? '—' : format(value);
  const size = compact ? 'h-8 min-w-0 p-0 text-caption max-sm:text-[10px]' : 'min-w-12 p-2';
  return (
    <td
      data-r={at}
      data-c={c}
      data-on={link?.column === c ? '' : undefined}
      {...pointing(link, at, c)}
      style={{ '--col': c, ...levelStyle(level) } as CSSProperties}
      className={`el-pop rounded-lg text-center tabular-nums group-data-[link]:ring-2 group-data-[link]:ring-accent data-[on]:ring-2 data-[on]:ring-neutral-900 ${size} ${level ? level.ink : 'bg-neutral-100 text-neutral-600'}`}
    >
      {text === '' ? <span className="sr-only">{value}</span> : text}
    </td>
  );
}

type Level = { ramp: string; ink: string; color?: string } | null;

const levelStyle = (level: Level): CSSProperties =>
  level ? { backgroundColor: level.ramp, color: level.color } : {};

/** What a square does when the grid answers the pointer: hover and focus point at it, one square holds the tab stop. */
function pointing(link: Live | undefined, row: number, column: number) {
  if (!link) return {};
  const key = `${row}-${column}`;
  const point = () => {
    link.setCur(key);
    link.onPoint({ row, column });
  };
  return {
    tabIndex: link.cur === key ? 0 : -1,
    onMouseEnter: point,
    onFocus: point,
    onBlur: () => link.onPoint(null),
  };
}

/** The background and ink of a square: the family's ramp step when there is a family, else the neutral thirds. */
function levelOf(
  value: number,
  scale: { min: number; max: number; family?: Family; mostValue: number },
): Level {
  if (scale.family) {
    const step = familyStep(value, scale.mostValue);
    return step === 0
      ? null
      : {
          ramp: `var(--color-family-${scale.family}-ramp-${step})`,
          ink: '',
          color: `var(--color-family-${scale.family}-ramp-ink-${step})`,
        };
  }
  return LEVELS[heatLevel(value, scale.min, scale.max)];
}
