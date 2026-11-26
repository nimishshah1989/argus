/* eslint-disable i18next/no-literal-string -- icon names only; every visible word comes in as a prop */
import { useContext } from 'react';
import { DrillOpenContext, stretchOf, useDestination, type Drill } from './drill.js';
import { Icon } from './icons.js';
import { useTick } from './motion.js';
import type { Status } from './status.js';

export type FigureData = {
  id: string;
  label: string;
  /** The figure exactly as the engine printed it. */
  value: string;
  /** The engine's own line under it, when it sent one. */
  sub: string;
  /** What the figure is measured against: previous period, target or peer ("Last month 3.4 h"). ADR 0026 §4. */
  yardstick?: string;
  /** The rows behind the figure: when given, the value is a button that opens them and the whole tile presses it. Absent: the tile looks itself up in the destinations map (ADR 0060). */
  drill?: Drill;
  /** Where the whole tile goes when pressed (the page that explains it), when it has no rows of its own. */
  link?: { href: string; label: string };
  /** How the figure is doing against its target (ADR 0036 R7): `data-status` on the card; absent → none. */
  status?: Status;
};

/** A key figure the engine printed with a line of its own and no change to compare: the value ticks in, the line stays. */
export function FigureTile({ figure }: { figure: FigureData }) {
  const value = useTick(figure.value);
  const open = useContext(DrillOpenContext);
  const to = useDestination(figure.id, figure.label, { drill: figure.drill, link: figure.link });
  const stretch = stretchOf(to);
  const { drill, link } = to;
  // neutral draws nothing: no attribute
  const status = figure.status === 'neutral' ? undefined : figure.status;
  return (
    <section
      className="v2-card v2-kpi"
      // A tile that goes somewhere is reached through its one control; only a tile that goes nowhere takes focus itself.
      tabIndex={stretch ? undefined : 0}
      aria-label={figure.label}
      data-status={status}
      data-open={stretch ? '' : undefined}
      data-stretch={stretch}
    >
      <div className="v2-kpi-label">{figure.label}</div>
      {drill && !link ? (
        <button
          key={value.n}
          type="button"
          className="v2-kpi-value v2-drill-value"
          data-flash={value.flash}
          aria-label={`${value.text}. ${drill.label}`}
          onClick={() => open(drill)}
        >
          {value.text}
          <Icon name="list" size={14} />
        </button>
      ) : (
        <div key={value.n} className="v2-kpi-value" data-flash={value.flash}>
          {value.text}
        </div>
      )}
      {figure.yardstick ? <span className="v2-yardstick">{figure.yardstick}</span> : null}
      {figure.sub && figure.sub !== figure.yardstick ? (
        <p className="v2-kpi-meaning">{figure.sub}</p>
      ) : null}
      {link ? (
        <a
          className="v2-ref v2-kpi-link"
          href={link.href}
          aria-label={`${figure.label}: ${link.label}`}
        >
          {link.label}
          <Icon name="chevronRight" size={12} />
        </a>
      ) : null}
    </section>
  );
}
