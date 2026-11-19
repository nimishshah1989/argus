import { useState, type CSSProperties } from 'react';
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

/** One square: its hours printed on its step of the ramp, lit when its month is the one pointed at. */
function Square({
  hours,
  month,
  on,
  onPoint,
}: {
  hours: number;
  month: number;
  on: boolean;
  onPoint: () => void;
}) {
  const step = stepOf(hours);
  const fill = step > 0 ? { background: RAMP[step - 1], color: inkOn(RAMP[step - 1]!) } : {};
  return (
    <td
      data-on={on ? '' : undefined}
      style={{ '--col': month, ...fill } as unknown as CSSProperties}
      onMouseEnter={onPoint}
    >
      {hours > 0 ? cellText(hours) : <span className="sr-only">0</span>}
    </td>
  );
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
  const [cell, setCell] = useState<{ id: string; month: number } | null>(null);
  const readout = cell
    ? `${cell.id} · ${monthLong(cell.month)} · ${fixed(S.heat.find((r) => r.id === cell.id)!.hours[cell.month], 1)} h`
    : t('heat.note');
  return (
    <section className="sc-card" aria-labelledby="sc-heat-title">
      <HeatHead />
      <table
        className="sc-heat"
        data-testid="heat-map"
        onMouseLeave={() => {
          setCell(null);
          onHover(pointed(null));
        }}
      >
        <caption className="sr-only">{t('heat.caption')}</caption>
        <colgroup>
          <col className="sc-heat-name" />
        </colgroup>
        <HeadRow active={hover.month} />
        <tbody>
          {S.heat.map((row) => (
            <tr key={row.id} data-link={machines.includes(row.id) ? '' : undefined}>
              <th scope="row">{row.id}</th>
              {row.hours.map((hours, i) => (
                <Square
                  key={i}
                  hours={hours}
                  month={i}
                  on={hover.month === i}
                  onPoint={() => {
                    setCell({ id: row.id, month: i });
                    onHover(pointed(i));
                  }}
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
