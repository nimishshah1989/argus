import type { CSSProperties } from 'react';
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
  if (max === min) return 0;
  const share = (value - min) / (max - min);
  return share < 1 / 3 ? 0 : share < 2 / 3 ? 1 : 2;
}

/**
 * Rows by columns, each cell shaded by its value and printing it. A missing value (`undefined`) prints `—` and
 * is not shaded. `label` names the grid; `format` prints a value with its unit.
 */
export function HeatGrid({
  label,
  rows,
  columns,
  values,
  format,
}: {
  label: string;
  rows: string[];
  columns: string[];
  values: (number | undefined)[][];
  format: (value: number) => string;
}) {
  if (rows.length === 0 || columns.length === 0) return null;
  const present = values.flat().filter((v): v is number => v !== undefined);
  const min = Math.min(...present);
  const max = Math.max(...present);
  return (
    <div role="region" aria-label={label} tabIndex={0} className="overflow-x-auto rounded-card">
      <table className="w-full border-separate border-spacing-1 text-footnote">
        <caption className="sr-only">{label}</caption>
        <thead>
          <tr>
            <td />
            {columns.map((column) => (
              <th key={column} scope="col" className={`p-1 text-center font-semibold ${WRAP}`}>
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <HeatRow
              key={row}
              row={row}
              columns={columns}
              values={values[r] ?? []}
              min={min}
              max={max}
              format={format}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HeatRow({
  row,
  columns,
  values,
  min,
  max,
  format,
}: {
  row: string;
  columns: string[];
  values: (number | undefined)[];
  min: number;
  max: number;
  format: (value: number) => string;
}) {
  return (
    <tr>
      <th scope="row" className={`p-1 text-left font-semibold ${WRAP}`}>
        {row}
      </th>
      {columns.map((column, c) => {
        const value = values[c];
        const level = value === undefined ? null : LEVELS[heatLevel(value, min, max)];
        return (
          <td
            key={column}
            style={
              { '--col': c, ...(level ? { backgroundColor: level.ramp } : {}) } as CSSProperties
            }
            className={`el-pop min-w-12 rounded-lg p-2 text-center tabular-nums ${
              level ? level.ink : 'bg-neutral-100 text-neutral-600'
            }`}
          >
            {value === undefined ? '—' : format(value)}
          </td>
        );
      })}
    </tr>
  );
}
