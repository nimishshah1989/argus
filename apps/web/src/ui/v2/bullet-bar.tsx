/* eslint-disable i18next/no-literal-string -- icon names and typed unions only; every visible word comes in as a prop or t() */
import { Icon } from './icons.js';
import { MOTION, useTick } from './motion.js';
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

/**
 * Where a value sits on the scale, as a CSS percentage kept inside the bar. An empty scale (from = to) puts every
 * mark at the start rather than dividing by zero.
 */
export function place([lo, hi]: [number, number]) {
  return (v: number) => {
    const share = hi === lo ? 0 : (v - lo) / (hi - lo);
    return `${(Math.min(1, Math.max(0, share)) * 100).toFixed(1)}%`;
  };
}

/** Actual against target and last month, with the good zone; the whole row opens its Why. */
export function BulletBar({ b }: { b: BulletData }) {
  const why = useWhy();
  const shown = useTick(b.shown);
  const at = place(b.scale);
  const zone = b.higherIsBetter
    ? { left: at(b.target), right: 0 }
    : { left: 0, width: at(b.target) };
  const clamp =
    b.value > Math.max(...b.scale) ? 'over' : b.value < Math.min(...b.scale) ? 'under' : undefined;
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
          <span className="v2-sub v2-block">{b.label}</span>
          <span className="v2-num v2-block" data-flash={shown.flash}>
            {shown.text}
            {b.unit}
          </span>
        </span>
        <span className="v2-stack v2-gap-6">
          <span role="img" aria-label={b.aria} className="v2-bullet-track">
            <span className="v2-bullet-zone" style={zone} />
            <span
              className={`v2-bullet-bar ${MOTION.growX}`}
              data-clamp={clamp}
              style={{ width: at(b.value) }}
            />
            <span className="v2-bullet-target" style={{ left: at(b.target) }} />
            <span className="v2-bullet-last" style={{ left: `calc(${at(b.lastMonth)} - 4px)` }} />
          </span>
          <span className={b.met ? 'v2-verdict-word v2-seg-gain' : 'v2-verdict-word v2-seg-loss'}>
            {b.verdict}
          </span>
        </span>
        <span className="v2-chev">
          <Icon name="chevronDown" size={14} />
        </span>
      </button>
      <WhyPanel why={why} points={b.why} well />
    </div>
  );
}

export type BulletLegendWords = { actual: string; target: string; last: string; zone: string };

/** The key under a set of bullet bars: this month, target, last month, good zone. */
export function BulletLegend({ words }: { words: BulletLegendWords }) {
  const keys = [
    ['v2-key-actual', words.actual],
    ['v2-key-target', words.target],
    ['v2-key-last', words.last],
    ['v2-key-zone', words.zone],
  ];
  return (
    <div className="v2-legend v2-legend-bullet">
      {keys.map(([mark, word]) => (
        <span key={mark} className="v2-row v2-gap-6">
          <span className={mark} aria-hidden="true" />
          {word}
        </span>
      ))}
    </div>
  );
}
