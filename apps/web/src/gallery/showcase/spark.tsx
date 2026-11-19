type Series = readonly (number | null)[];

interface Point {
  x: number;
  y: number;
}

/** Lay a series out on a 100 by 100 box with 12 % of padding; a gap (null) is left out. */
function layout(values: Series, lo: number, hi: number): (Point | null)[] {
  const n = Math.max(1, values.length - 1);
  const span = hi - lo || 1;
  return values.map((v, i) =>
    v === null ? null : { x: (i / n) * 100, y: 88 - ((v - lo) / span) * 76 },
  );
}

/** A path with a new sub-path after every gap, so a missing month breaks the line instead of bridging it. */
function pathOf(points: (Point | null)[]): string {
  let d = '';
  let pen = false;
  for (const p of points) {
    if (!p) pen = false;
    else {
      d += `${pen ? 'L' : 'M'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
      pen = true;
    }
  }
  return d;
}

const dotStyle = (p: Point) => ({ left: `${p.x}%`, top: `${p.y}%` });

/**
 * A word-sized trend line with no axes (the figure beside it carries the value). `reference` draws a second dotted
 * series on the same scale; `active` is the month the person is pointing at elsewhere on the page. It is drawn in
 * once (CSS) and not at all under reduced motion.
 */
export function Spark({
  values,
  reference,
  active,
  tone = 'accent',
}: {
  values: Series;
  reference?: Series;
  active?: number | null;
  tone?: 'accent' | 'ink';
}) {
  const all = [...values, ...(reference ?? [])].filter((v): v is number => v !== null);
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const own = layout(values, lo, hi);
  const ref = reference ? layout(reference, lo, hi) : null;
  const line = pathOf(own);
  const last = [...own].reverse().find((p): p is Point => p !== null);
  const at = active !== null && active !== undefined ? own[active] : undefined;
  return (
    <span className="sc-spark" data-tone={tone} aria-hidden="true">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        {ref ? <path className="sc-spark-ref" d={pathOf(ref)} /> : null}
        {at ? <line className="sc-spark-cursor" x1={at.x} x2={at.x} y1="0" y2="100" /> : null}
        <path className="sc-spark-line" d={line} pathLength={1} />
      </svg>
      {last ? <span className="sc-spark-dot" style={dotStyle(last)} /> : null}
      {at && at !== last ? (
        <span className="sc-spark-dot" data-active="" style={dotStyle(at)} />
      ) : null}
    </span>
  );
}
