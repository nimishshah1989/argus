import { MOTION } from './motion.js';

const DAYS = 90;
const PER_BAR = 3;

/**
 * Ninety days as 30 small bars of three days each; a bar is taller for every event in it. `days` are the
 * events' day numbers, 0 the oldest and 89 today.
 */
export function EventStrip({
  days,
  label,
  caption,
}: {
  days: number[];
  label: string;
  caption: string;
}) {
  const bars = Array.from({ length: DAYS / PER_BAR }, () => 0);
  for (const d of days) if (d >= 0 && d < DAYS) bars[Math.floor(d / PER_BAR)]! += 1;
  return (
    <div className="v2-strip-box">
      <div role="img" aria-label={label} className="v2-strip">
        {bars.map((n, i) => (
          <span
            key={i}
            className={n ? `v2-strip-bar v2-strip-hit ${MOTION.growY}` : 'v2-strip-bar'}
            style={{ height: n ? Math.min(22, 8 + n * 7) : 4 }}
          />
        ))}
      </div>
      <span className="v2-sub">{caption}</span>
    </div>
  );
}
