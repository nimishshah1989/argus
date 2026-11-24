/* eslint-disable i18next/no-literal-string -- icon names only; every visible word comes in as a prop */
import { useContext } from 'react';
import { DrillOpenContext, type Drill } from './drill.js';
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
  /** The rows behind the figure: when given, the value is a button that opens them. */
  drill?: Drill;
  /** How the figure is doing against its target (ADR 0036 R7): `data-status` on the card; absent → none. */
  status?: Status;
};

/** A key figure the engine printed with a line of its own and no change to compare: the value ticks in, the line stays. */
export function FigureTile({ figure }: { figure: FigureData }) {
  const value = useTick(figure.value);
  const open = useContext(DrillOpenContext);
  return (
    <section className="v2-card v2-kpi" tabIndex={0} aria-label={figure.label}>
      <div className="v2-kpi-label">{figure.label}</div>
      {figure.drill ? (
        <button
          key={value.n}
          type="button"
          className="v2-kpi-value v2-drill-value"
          data-flash={value.flash}
          aria-label={`${value.text}. ${figure.drill.label}`}
          onClick={() => figure.drill && open(figure.drill)}
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
      {figure.sub ? <p className="v2-kpi-meaning">{figure.sub}</p> : null}
    </section>
  );
}
