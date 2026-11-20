/* eslint-disable i18next/no-literal-string -- icon names and typed unions only; every visible word comes in as a prop or t() */
import { Icon, type IconName } from './icons.js';
import { useTick } from './motion.js';
import { Sparkline } from './sparkline.js';

export type KpiData = {
  id: string;
  label: string;
  icon: IconName;
  /** The figure exactly as the engine printed it. */
  value: string;
  /** The change against `period`, signed (`+9%`), with its direction and whether that direction is good. `flat`: no change, neutral and no arrow. */
  delta: { text: string; up: boolean; good: boolean; flat?: boolean };
  period: string;
  /** One line on what the figure means. */
  meaning: string;
  /** One more line, shown on hover or focus. */
  more: string;
  /** The recent trend, oldest first, when there is one. */
  trend?: number[];
};

/** A key figure: value, its change against a stated period, what it means, its trend, and one line more on hover. */
export function KpiCard({ kpi }: { kpi: KpiData }) {
  const value = useTick(kpi.value);
  const tone = kpi.delta.flat ? 'neutral' : kpi.delta.good ? 'gain' : 'loss';
  return (
    <section className="v2-card v2-kpi" tabIndex={0} aria-label={kpi.label}>
      <div className="v2-kpi-label">
        <span className="v2-kpi-icon">
          <Icon name={kpi.icon} size={15} />
        </span>
        {kpi.label}
      </div>
      <div className="v2-kpi-row">
        <div>
          <div key={value.n} className="v2-kpi-value" data-flash={value.flash}>
            {value.text}
          </div>
          <span className={`v2-delta v2-delta-${tone}`}>
            {kpi.delta.flat ? null : <Icon name={kpi.delta.up ? 'up' : 'down'} size={12} />}
            {kpi.delta.text} {kpi.period}
          </span>
        </div>
        {kpi.trend ? <Sparkline values={kpi.trend} tone={tone} draw /> : null}
      </div>
      <p className="v2-kpi-meaning">{kpi.meaning}</p>
      <p className="v2-kpi-more">{kpi.more}</p>
    </section>
  );
}
