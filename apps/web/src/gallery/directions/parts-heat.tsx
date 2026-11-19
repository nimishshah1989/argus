import { useTranslation } from 'react-i18next';
import { inkOn } from './parts-palette.js';
import { addStrings } from './strings.js';
import { formatIN } from './variant.js';

addStrings({
  'heat.cell': 'Cell',
  'heat.note':
    'The stronger the colour, the more breakdown hours. The most in one square is {{most}} h.',
});

export interface HeatRow {
  name: string;
  values: number[];
}

/** Which of the ramp's 5 steps a value takes: none for zero, then fifths of the largest value in the grid. */
export function rampStep(value: number, most: number): number {
  return value <= 0 ? 0 : Math.min(5, Math.ceil((value / most) * 5));
}

/** One square: its number always, and its step of the ramp when there is any. */
function Square({ value, most, ramp }: { value: number; most: number; ramp: string[] }) {
  const step = rampStep(value, most);
  const fill =
    step > 0
      ? { background: `var(--proto-seq-${step})`, color: inkOn(ramp[step - 1]!) }
      : undefined;
  return (
    <td className="border border-neutral-200 py-2" style={fill}>
      {formatIN(value)}
    </td>
  );
}

/** A grid of rows by cells on the direction's sequential ramp; every square also prints its number, so colour never works alone. */
export function HeatGrid({
  cells,
  rows,
  ramp,
  caption,
}: {
  cells: string[];
  rows: HeatRow[];
  ramp: string[];
  caption: string;
}) {
  const { t } = useTranslation('directions');
  const most = Math.max(...rows.flatMap((r) => r.values));
  return (
    <div className="flex flex-col gap-2">
      <table data-heat className="w-full table-fixed border-collapse text-center text-caption">
        <caption className="sr-only">{caption}</caption>
        <colgroup>
          <col className="w-[28%]" />
        </colgroup>
        <thead>
          <tr>
            <td />
            {cells.map((cell) => (
              <th key={cell} scope="col" className="py-1 font-semibold text-neutral-600">
                <span className="sr-only">{t('heat.cell')} </span>
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name}>
              <th scope="row" className="py-1 pr-2 text-left font-normal">
                {row.name}
              </th>
              {row.values.map((value, i) => (
                <Square key={cells[i]} value={value} most={most} ramp={ramp} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-footnote text-neutral-600">{t('heat.note', { most: formatIN(most) })}</p>
    </div>
  );
}
