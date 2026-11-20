import { useTick } from './motion.js';

export type FigureData = {
  id: string;
  label: string;
  /** The figure exactly as the engine printed it. */
  value: string;
  /** The engine's own line under it, when it sent one. */
  sub: string;
};

/** A key figure the engine printed with a line of its own and no change to compare: the value ticks in, the line stays. */
export function FigureTile({ figure }: { figure: FigureData }) {
  const value = useTick(figure.value);
  return (
    <section className="v2-card v2-kpi" tabIndex={0} aria-label={figure.label}>
      <div className="v2-kpi-label">{figure.label}</div>
      <div key={value.n} className="v2-kpi-value" data-flash={value.flash}>
        {value.text}
      </div>
      {figure.sub ? <p className="v2-kpi-meaning">{figure.sub}</p> : null}
    </section>
  );
}
