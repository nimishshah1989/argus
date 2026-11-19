import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { MessageKey } from '@uptimo/shared/i18n';
import { heatColor, heatInk } from './EnergyGrids.js';

/** The 39b screens' shared pieces: a titled section, one figure card and a plain data table. Tokens only. */

export function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={headingId} className="text-title3 font-semibold">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** One figure: its label, value, optional sub-line and unit (a catalogue key). */
export function StatCard({
  label,
  value,
  sub,
  unit,
}: {
  label: string;
  value: string;
  sub?: string | null;
  unit?: MessageKey;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-2xl bg-surface p-4 shadow-card">
      <span className="text-footnote text-neutral-600">{label}</span>
      <span className="text-title2 font-semibold tabular-nums">
        {value}
        {unit ? <span className="text-title3 font-medium"> {t(unit)}</span> : null}
      </span>
      {sub ? <span className="text-caption text-neutral-600">{sub}</span> : null}
    </div>
  );
}

/**
 * A plain table of the engine's cells: a header row and its rows, both already written by the engine. A screen
 * that needs a link inside one cell passes `renderCell`; the table itself stays the one renderer.
 */
export function DataTable({
  title,
  header,
  rows,
  renderCell,
}: {
  title?: string | null;
  header: readonly string[];
  rows: readonly (readonly string[])[];
  renderCell?: (cell: string, rowIndex: number, columnIndex: number) => ReactNode;
}) {
  const headingId = useId();
  const label = title ?? header.join(' · ');
  return (
    <div className="flex flex-col gap-2">
      {title ? (
        <h3 id={headingId} className="text-body font-semibold">
          {title}
        </h3>
      ) : null}
      <div className="overflow-x-auto rounded-2xl bg-surface shadow-card">
        <table
          aria-labelledby={title ? headingId : undefined}
          aria-label={title ? undefined : label}
          className="w-full text-left text-footnote"
        >
          <thead>
            <tr>
              {header.map((cell, index) => (
                <th
                  key={`${cell}-${index}`}
                  scope="col"
                  className="p-2 font-medium text-neutral-600"
                >
                  {cell}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-t border-neutral-200">
                {row.map((cell, index) => (
                  <td key={index} className="p-2">
                    {renderCell ? renderCell(cell, rowIndex, index) : cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** The two columns a heat table never paints: a row's total and the share it has passed are sums, not cells. */
const PLAIN = new Set(['Total', 'Cumulative %']);

/** A printed cell as a number (grouping commas and a trailing % read), or null for a dash. */
function numericOf(cell: string): number | null {
  const cleaned = cell.replaceAll(',', '').replace('%', '').trim();
  if (cleaned === '' || cleaned === '—') return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

/** The columns a heat table paints and the range its cells are ranged over: the numeric cells, never the totals. */
function heatRange(
  header: readonly string[],
  rows: readonly (readonly string[])[],
): { heated: boolean[]; min: number; max: number } {
  const heated = header.map((cell, index) => index > 0 && !PLAIN.has(cell));
  const values = rows.flatMap((row) =>
    row.flatMap((cell, index) => {
      const value = heated[index] === true ? numericOf(cell) : null;
      return value === null ? [] : [value];
    }),
  );
  return {
    heated,
    min: values.length === 0 ? 0 : Math.min(...values),
    max: values.length === 0 ? 0 : Math.max(...values),
  };
}

/** One matrix row: its name plain, its numeric cells painted on the grid's green scale. */
function HeatRow({
  row,
  heated,
  min,
  max,
}: {
  row: readonly string[];
  heated: readonly boolean[];
  min: number;
  max: number;
}) {
  return (
    <tr className="border-t border-neutral-200">
      {row.map((cell, index) => {
        const value = heated[index] === true ? numericOf(cell) : null;
        return (
          <td
            key={index}
            className="p-2 tabular-nums"
            style={
              value === null
                ? undefined
                : { backgroundColor: heatColor(value, min, max), color: heatInk(value, min, max) }
            }
          >
            {cell}
          </td>
        );
      })}
    </tr>
  );
}

/**
 * A heat matrix (48c): the engine's own table, with every numeric cell between the row's name and its total painted
 * on the platform's green scale. The cells and their text are the engine's; only the paint is the face's, so a month
 * with no hours stays a dash and never a zero. Used by any table the engine marks `heat`.
 */
export function HeatTable({
  title,
  header,
  rows,
}: {
  title?: string | null;
  header: readonly string[];
  rows: readonly (readonly string[])[];
}) {
  const headingId = useId();
  const label = title ?? header.join(' · ');
  const { heated, min, max } = heatRange(header, rows);
  return (
    <div className="flex flex-col gap-2">
      {title ? (
        <h3 id={headingId} className="text-body font-semibold">
          {title}
        </h3>
      ) : null}
      <div className="overflow-x-auto rounded-2xl bg-surface shadow-card">
        <table
          data-heat="matrix"
          aria-labelledby={title ? headingId : undefined}
          aria-label={title ? undefined : label}
          className="w-full text-left text-footnote"
        >
          <thead>
            <tr>
              {header.map((cell, index) => (
                <th
                  key={`${cell}-${index}`}
                  scope="col"
                  className="p-2 font-medium text-neutral-600"
                >
                  {cell}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <HeatRow key={index} row={row} heated={heated} min={min} max={max} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
