import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { MessageKey } from '@uptimo/shared/i18n';

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
