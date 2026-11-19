/* eslint-disable i18next/no-literal-string -- only class names, data attributes and column positions remain; every word goes through t() */
import { useTranslation } from 'react-i18next';
import { addStrings } from './strings.js';

addStrings({
  'log.date': 'Date',
  'log.machine': 'Machine',
  'log.problem': 'Problem',
  'log.hours': 'Hours',
});

const DAY = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** The log writes `07-11-2026`; the screen prints `7 Nov`, the year being the snapshot's. */
function day(text: string): string {
  const [d, m, y] = text.split('-').map(Number);
  return DAY.format(new Date(Date.UTC(y!, m! - 1, d!)));
}

/** Date, machine, problem and downtime hours of breakdown-log rows, as many as it is given (the snapshot holds 50). */
export function LogTable({ rows, caption }: { rows: string[][]; caption: string }) {
  const { t } = useTranslation('directions');
  return (
    <table data-log className="w-full table-fixed text-left text-caption">
      <caption className="sr-only">{caption}</caption>
      <colgroup>
        <col className="w-[18%]" />
        <col className="w-[20%]" />
        <col />
        <col className="w-[15%]" />
      </colgroup>
      <thead>
        <tr className="text-neutral-600">
          {['date', 'machine', 'problem', 'hours'].map((id) => (
            <th key={id} scope="col" className="py-2 pr-2 font-semibold">
              {t(`log.${id}`)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row[2]} className="border-t border-neutral-200 align-top">
            <td className="py-2 pr-2">{day(row[3]!)}</td>
            <td className="py-2 pr-2">{row[5]}</td>
            <td className="py-2 pr-2 [overflow-wrap:anywhere]">{row[6]}</td>
            <td className="py-2">{row[8]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
