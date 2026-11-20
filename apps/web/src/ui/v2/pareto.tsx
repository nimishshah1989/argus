import { useContext, type ReactNode } from 'react';
import { DrillOpenContext, type Drill } from './drill.js';
import { MOTION } from './motion.js';
import { Segs, type Point } from './points.js';
import { WhyToggle } from './why-toggle.js';

export type ParetoData = {
  /** Biggest first, the rest in a last bar; `shown` is the engine's figure, `hours` places the bar. */
  bars: { label: string; hours: number; shown: string; drill?: Drill }[];
  /** How many of the first bars are the ones to fix; a line marks the split. */
  top: number;
  /** All the hours the bars share out: the bars must add up to it (`paretoMismatch`). */
  total: number;
  aria: string;
  conclusion: Point;
  why: Point[];
};

/** Why the bars cannot be the whole of `total`, or null when they are (to 0.1 h, the printed precision). */
export function paretoMismatch(data: ParetoData): string | null {
  const sum = data.bars.reduce((s, b) => s + b.hours, 0);
  return Math.abs(sum - data.total) > 0.05
    ? `bars add up to ${sum.toFixed(1)}, total is ${data.total}`
    : null;
}

// Fixed pixels, so text stays 13 px on a phone: the chart scrolls inside its own box instead of shrinking.
const W = 760;
const TOP = 28;
const BASE = 196;
const H = BASE + 48;
const BAR = 64;
const GAP = 20;
const X0 = 8;
const AXIS = W - 44;
const TICKS = [0, 25, 50, 75, 100];
const yOf = (share: number) => BASE - share * (BASE - TOP);

/** A bar that has rows behind it is also a button over its whole column; the chart under it stays one picture. */
function BarDrills({ bars }: { bars: ParetoData['bars'] }) {
  const open = useContext(DrillOpenContext);
  return bars.map((b, i) => {
    const drill = b.drill;
    return drill ? (
      <button
        key={b.label}
        type="button"
        className="v2-bar-drill"
        style={{ left: X0 + i * (BAR + GAP) - GAP / 2, width: BAR + GAP, height: H }}
        aria-label={drill.label}
        title={drill.label}
        onClick={() => open(drill)}
      />
    ) : null;
  });
}

function Chart({ data }: { data: ParetoData }) {
  const max = Math.max(...data.bars.map((b) => b.hours), 0.1);
  const sum = data.bars.reduce((s, b) => s + b.hours, 0) || 1;
  let running = 0;
  const bars = data.bars.map((b, i) => {
    running += b.hours;
    const h = (b.hours / max) * (BASE - TOP);
    const x = X0 + i * (BAR + GAP);
    return { ...b, x, cx: x + BAR / 2, y: BASE - h, h, cy: yOf(running / sum) };
  });
  const last = bars[bars.length - 1];
  const split = X0 + data.top * (BAR + GAP) - GAP / 2;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={data.aria}>
      {TICKS.map((p) => (
        <g key={p}>
          <line x1={X0} x2={AXIS - 6} y1={yOf(p / 100)} y2={yOf(p / 100)} className="v2-gridline" />
          <text x={AXIS} y={yOf(p / 100) + 4} className="v2-svg-note" data-tick={p}>
            {`${p}%`}
          </text>
        </g>
      ))}
      {bars.map((b, i) => (
        <g key={b.label}>
          <rect
            x={b.x}
            y={b.y}
            width={BAR}
            height={b.h}
            rx={5}
            className={`${i < data.top ? 'v2-bar-top' : 'v2-bar'} ${MOTION.growY}`}
          >
            <title>{b.label}</title>
          </rect>
          <text x={b.cx} y={BASE + 18} textAnchor="middle" className="v2-svg-value">
            {b.shown}
          </text>
          <text x={b.cx} y={BASE + 38} textAnchor="middle" className="v2-svg-note">
            {b.label}
          </text>
        </g>
      ))}
      <line x1={split} x2={split} y1={TOP} y2={BASE} className="v2-split" />
      <g className={MOTION.draw}>
        <polyline points={bars.map((b) => `${b.cx},${b.cy}`).join(' ')} className="v2-running" />
        {bars.map((b) => (
          <circle key={b.label} cx={b.cx} cy={b.cy} r={3} className="v2-running-dot" />
        ))}
        {last ? (
          <text x={last.cx} y={last.cy - 10} textAnchor="middle" className="v2-svg-value" data-end>
            {`${Math.round((running / sum) * 100)}%`}
          </text>
        ) : null}
      </g>
    </svg>
  );
}

/** Bars with a running total that ends at 100 %, a split after the few that matter, and the conclusion. */
export function Pareto({
  data,
  whyLabel,
  actions,
}: {
  data: ParetoData;
  whyLabel: string;
  actions: ReactNode;
}) {
  if (import.meta.env?.DEV) {
    const wrong = paretoMismatch(data);
    if (wrong) console.error(`Pareto: ${wrong}`);
  }
  return (
    <div className="v2-pareto">
      <div className="v2-scroll" tabIndex={0}>
        <div className="v2-plot" style={{ width: W, height: H }}>
          <Chart data={data} />
          <BarDrills bars={data.bars} />
        </div>
      </div>
      <div className="v2-stack v2-gap-12">
        <p className="v2-lede">
          <Segs point={data.conclusion} />
        </p>
        <WhyToggle label={whyLabel} points={data.why} />
        <div className="v2-row v2-gap-8">{actions}</div>
      </div>
    </div>
  );
}
