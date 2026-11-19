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

/** Everything the sparkline draws, worked out from its series: the solid line, the running stretch, the end and the pointed month. */
function shape(
  values: Series,
  reference: Series | undefined,
  partial: boolean,
  active?: number | null,
) {
  const all = [...values, ...(reference ?? [])].filter((v): v is number => v !== null);
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const own = layout(values, lo, hi);
  const n = own.length;
  return {
    ref: reference ? pathOf(layout(reference, lo, hi)) : null,
    line: pathOf(partial ? own.map((p, i) => (i === n - 1 ? null : p)) : own),
    running: partial ? pathOf(own.map((p, i) => (i >= n - 2 ? p : null))) : null,
    last: [...own].reverse().find((p): p is Point => p !== null),
    at: active === null || active === undefined ? undefined : own[active],
    cursor:
      active === null || active === undefined || active >= n
        ? null
        : (active / Math.max(1, n - 1)) * 100,
  };
}

/**
 * A word-sized trend line with no axes (the figure beside it carries the value). `reference` draws a second dotted
 * series on the same scale; `active` is the month the person is pointing at elsewhere on the page; `partial` marks
 * the last value as a month still running (dashed, hollow dot). It is drawn in once (CSS), not under reduced motion.
 */
export function Spark({
  values,
  reference,
  active,
  tone = 'accent',
  partial = false,
}: {
  values: Series;
  reference?: Series;
  active?: number | null;
  tone?: 'accent' | 'ink';
  partial?: boolean;
}) {
  const { ref, line, running, last, at, cursor } = shape(values, reference, partial, active);
  return (
    <span className="sc-spark" data-tone={tone} aria-hidden="true">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        {ref ? <path className="sc-spark-ref" d={ref} /> : null}
        {cursor !== null ? (
          <line className="sc-spark-cursor" x1={cursor} x2={cursor} y1="0" y2="100" />
        ) : null}
        <path className="sc-spark-line" d={line} pathLength={1} />
        {running ? <path className="sc-spark-line sc-spark-part" d={running} /> : null}
      </svg>
      {last ? (
        <span
          className="sc-spark-dot"
          data-partial={partial ? '' : undefined}
          style={dotStyle(last)}
        />
      ) : null}
      {at && at !== last ? (
        <span className="sc-spark-dot" data-active="" style={dotStyle(at)} />
      ) : null}
    </span>
  );
}
