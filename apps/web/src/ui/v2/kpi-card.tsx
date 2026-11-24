/* eslint-disable i18next/no-literal-string -- icon names and typed unions only; every visible word comes in as a prop or t() */
import { useContext } from 'react';
import { DrillOpenContext, type Drill } from './drill.js';
import { Icon, type IconName } from './icons.js';
import { useTick } from './motion.js';
import { Sparkline } from './sparkline.js';

export type KpiData = {
  id: string;
  label: string;
  icon: IconName;
  /** The figure exactly as the engine printed it. */
  value: string;
  /** The change against `period`, signed (`+9%`), with its direction and whether that direction is good. `flat`: no change, neutral and no arrow. An empty `text` says nothing: the engine holds no earlier figure to compare with. */
  delta: { text: string; up: boolean; good: boolean; flat?: boolean };
  period: string;
  /** One line on what the figure means. */
  meaning: string;
  /** One more line, shown on hover or focus. */
  more: string;
  /** The recent trend, oldest first, when there is one. */
  trend?: number[];
  /** The rows behind the figure: when given, the value is a button that opens them. */
  drill?: Drill;
  /** What kind of number this is, where its direction of good is known: a thin rule and a tinted icon in that meaning's colour. Absent: neutral. */
  tone?: 'loss' | 'gain' | 'risk' | 'plan';
  /** The lead figure of its group: twice the width and height, with `meter` drawn under the value. */
  hero?: boolean;
  /** How full the meter under a hero's value is, 0 to 1: the engine's own percent, drawn and not recomputed. */
  meter?: number;
  /** What the figure is measured against when `delta` has no text: a target or a peer ("Target 2.0 h"). ADR 0026 §4. */
  yardstick?: string;
  /** Where the whole card goes when pressed (a register): it then outranks the value button as the card's way in. */
  link?: { href: string; label: string };
};

type Tone = 'gain' | 'loss' | 'neutral';

/** The value in the number face; a button that opens the rows behind it when the figure has them. */
function Value({ kpi }: { kpi: KpiData }) {
  const value = useTick(kpi.value);
  const open = useContext(DrillOpenContext);
  const { drill } = kpi;
  if (!drill)
    return (
      <div key={value.n} className="v2-kpi-value" data-flash={value.flash}>
        {value.text}
      </div>
    );
  return (
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
  );
}

/** The change against its period, signed, with its direction; nothing when the engine holds no earlier figure. */
function Delta({ kpi, tone }: { kpi: KpiData; tone: Tone }) {
  if (kpi.delta.text === '')
    return kpi.yardstick ? <span className="v2-yardstick">{kpi.yardstick}</span> : null;
  return (
    <span className={`v2-delta v2-delta-${tone}`}>
      {kpi.delta.flat ? null : <Icon name={kpi.delta.up ? 'up' : 'down'} size={12} />}
      {kpi.delta.text} {kpi.period}
    </span>
  );
}

/** What the whole card is when pressed: a link to a page, the rows behind its figure, or nothing. */
const stretchOf = (kpi: KpiData) => (kpi.link ? 'link' : kpi.drill ? 'drill' : undefined);

/** A key figure: value, its change against a stated period, what it means, its trend, and one line more on hover. */
export function KpiCard({ kpi }: { kpi: KpiData }) {
  const tone: Tone = kpi.delta.flat ? 'neutral' : kpi.delta.good ? 'gain' : 'loss';
  const stretch = stretchOf(kpi);
  return (
    <section
      className={kpi.hero ? 'v2-card v2-kpi v2-kpi-hero' : 'v2-card v2-kpi'}
      data-tone={kpi.tone}
      data-open={stretch ? '' : undefined}
      data-stretch={stretch}
      tabIndex={0}
      aria-label={kpi.label}
    >
      <div className="v2-kpi-label">
        <span className="v2-kpi-icon">
          <Icon name={kpi.icon} size={15} />
        </span>
        {kpi.label}
      </div>
      <div className="v2-kpi-row">
        <div>
          <Value kpi={kpi} />
          <Delta kpi={kpi} tone={tone} />
        </div>
        {kpi.trend ? <Sparkline values={kpi.trend} tone={tone} draw /> : null}
      </div>
      {kpi.meter === undefined ? null : (
        <div className="v2-kpi-meter" aria-hidden="true">
          <span style={{ width: `${Math.min(100, Math.max(0, kpi.meter * 100)).toFixed(1)}%` }} />
        </div>
      )}
      <p className="v2-kpi-meaning">{kpi.meaning}</p>
      <p className="v2-kpi-more">{kpi.more}</p>
      {kpi.link ? (
        <a className="v2-ref v2-kpi-link" href={kpi.link.href}>
          {kpi.link.label}
          <Icon name="chevronRight" size={12} />
        </a>
      ) : null}
    </section>
  );
}
