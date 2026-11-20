import { ChevronDown } from '../icon.js';
import type { Point } from './points.js';
import { useWhy, WhyPanel } from './why-toggle.js';

export type BulletData = {
  id: string;
  label: string;
  /** The figure exactly as the engine printed it, and its unit. */
  shown: string;
  unit: string;
  /** Where the marks sit on the scale [from, to]; the engine's numbers, never recomputed for display. */
  value: number;
  target: number;
  lastMonth: number;
  scale: [number, number];
  higherIsBetter: boolean;
  met: boolean;
  verdict: string;
  /** What the bar says aloud. */
  aria: string;
  why: Point[];
};

/** Actual against target and last month, with the good zone; the whole row opens its Why. */
export function BulletBar({ b }: { b: BulletData }) {
  const why = useWhy();
  const [lo, hi] = b.scale;
  const at = (v: number) =>
    `${Math.min(100, Math.max(0, ((v - lo) / (hi - lo)) * 100)).toFixed(1)}%`;
  const zone = b.higherIsBetter
    ? { left: at(b.target), right: 0 }
    : { left: 0, width: at(b.target) };
  return (
    <div className="v2-bullet">
      <button
        type="button"
        className="v2-rowbtn"
        aria-expanded={why.open}
        aria-controls={why.id}
        onClick={why.toggle}
      >
        <span>
          <span className="v2-note v2-block">{b.label}</span>
          <b className="v2-num">
            {b.shown}
            {b.unit}
          </b>
        </span>
        <span className="v2-stack v2-gap-6">
          <span role="img" aria-label={b.aria} className="v2-bullet-track">
            <span className="v2-bullet-zone" style={zone} />
            <span className="v2-bullet-bar" style={{ width: at(b.value) }} />
            <span className="v2-bullet-target" style={{ left: at(b.target) }} />
            <span className="v2-bullet-last" style={{ left: `calc(${at(b.lastMonth)} - 4px)` }} />
          </span>
          <span className={b.met ? 'v2-verdict-word v2-seg-gain' : 'v2-verdict-word v2-seg-loss'}>
            {b.verdict}
          </span>
        </span>
        <ChevronDown className="v2-chev" size={14} strokeWidth={2.5} aria-hidden="true" />
      </button>
      <WhyPanel why={why} points={b.why} well />
    </div>
  );
}
