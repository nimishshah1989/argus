import type { ReactNode } from 'react';
import { Segs, type Point } from './points.js';
import { WhyToggle } from './why-toggle.js';

export type ParetoData = {
  /** Biggest first; `shown` is the engine's figure, `hours` places the bar. */
  bars: { label: string; hours: number; shown: string }[];
  /** How many of the first bars are the ones to fix; a line marks the split. */
  top: number;
  /** All breakdown hours, the running total's 100 %. */
  total: number;
  aria: string;
  conclusion: Point;
  why: Point[];
};

const W = 760;
const BASE = 222;
const TALL = 190;
const BAR = 70;
const GAP = 22;
const X0 = 20;

/** Bars with a running-total line and a split after the few that matter, then the conclusion beside them. */
export function Pareto({
  data,
  whyLabel,
  actions,
}: {
  data: ParetoData;
  whyLabel: string;
  actions: ReactNode;
}) {
  const max = Math.max(...data.bars.map((b) => b.hours), 1);
  const total = data.total || 1;
  let running = 0;
  const bars = data.bars.map((b, i) => {
    running += b.hours;
    const h = (b.hours / max) * TALL;
    const x = X0 + i * (BAR + GAP);
    return { ...b, x, cx: x + BAR / 2, y: BASE - h, h, cy: BASE - (running / total) * (BASE - 12) };
  });
  const split = X0 + data.top * (BAR + GAP) - GAP / 2;
  return (
    <div className="v2-pareto">
      <div className="v2-scroll">
        <svg viewBox={`0 0 ${W} 250`} className="v2-pareto-svg" role="img" aria-label={data.aria}>
          {bars.map((b, i) => (
            <g key={b.label}>
              <rect
                x={b.x}
                y={b.y}
                width={BAR}
                height={b.h}
                rx={5}
                className={i < data.top ? 'v2-bar-top' : 'v2-bar'}
              />
              <text x={b.cx} y={b.y - 6} textAnchor="middle" className="v2-svg-strong">
                {b.shown}
              </text>
              <text x={b.cx} y={242} textAnchor="middle" className="v2-svg-note">
                {b.label}
              </text>
            </g>
          ))}
          <polyline points={bars.map((b) => `${b.cx},${b.cy}`).join(' ')} className="v2-running" />
          {bars.map((b) => (
            <circle key={b.label} cx={b.cx} cy={b.cy} r={3} className="v2-running-dot" />
          ))}
          <line x1={split} x2={split} y1={8} y2={BASE} className="v2-split" />
        </svg>
      </div>
      <div className="v2-stack v2-gap-12">
        <p className="v2-hero">
          <Segs point={data.conclusion} />
        </p>
        <WhyToggle label={whyLabel} points={data.why} />
        <div className="v2-row v2-gap-8">{actions}</div>
      </div>
    </div>
  );
}
