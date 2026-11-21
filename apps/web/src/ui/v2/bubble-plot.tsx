import { useMemo, useRef, useState, type PointerEvent, type WheelEvent } from 'react';
import { fullView, inside, panned, ticks, zoomed, type View } from './bubble-math.js';

/** One bubble: where it sits, how big it is, the type colour it wears and the lines its tooltip prints. */
export type BubbleDot = {
  id: string;
  /** What the tooltip is headed with (a machine's code); a dash for a machine the plant no longer lists. */
  title: string;
  x: number;
  y: number;
  /** The bubble's radius in pixels, as the engine sized it. */
  r: number;
  /** The machine type's colour, 1 to 5. */
  cat?: number;
  /** Every line of the tooltip, already worded and formatted. */
  tip: string[];
  /** Whether pressing the bubble opens something; false for a machine the plant no longer lists. */
  opens: boolean;
};

export type BubbleWords = {
  xLabel: string;
  yLabel: string;
  zoomIn: string;
  zoomOut: string;
  reset: string;
  /** What the picture is, for those who cannot see it. */
  aria: string;
  /** Said inside the picture when no bubble is left (every filter on). */
  empty: string;
};

/** One zoom step: a button press or a wheel notch makes the window 70 % as wide, or the reverse. */
const FACTOR = 0.7;
/** Pointer movement, as a share of the plot, that turns a press into a drag. */
const DRAG_SLOP = 0.004;

const place = (v: number, lo: number, hi: number) =>
  `${(((v - lo) / (hi - lo)) * 100).toFixed(2)}%`;

/** The window, the zoom and pan that move it, and the tooltip's bubble: everything the plot keeps. */
function usePlot(dots: readonly BubbleDot[]) {
  const full = useMemo(() => fullView(dots), [dots]);
  const [view, setView] = useState<View>(full);
  const [seen, setSeen] = useState(full);
  const [tip, setTip] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  // A new set of dots (a filter) starts from the whole picture, as Bhavin's did.
  if (seen !== full) {
    setSeen(full);
    setView(full);
  }
  const rect = () => box.current?.getBoundingClientRect();
  const handlers = {
    onWheel: (e: WheelEvent) => {
      const r = rect();
      if (!e.ctrlKey || !r || r.width === 0) return;
      const at = { x: (e.clientX - r.left) / r.width, y: 1 - (e.clientY - r.top) / r.height };
      setView((was) => zoomed(was, full, e.deltaY > 0 ? 1 / FACTOR : FACTOR, at));
    },
    onPointerDown: (e: PointerEvent) => {
      drag.current = { x: e.clientX, y: e.clientY, moved: false };
    },
    onPointerMove: (e: PointerEvent) => {
      const d = drag.current;
      const r = rect();
      if (!d || !r || r.width === 0 || (e.buttons & 1) === 0) return;
      const [dx, dy] = [(e.clientX - d.x) / r.width, -(e.clientY - d.y) / r.height];
      if (Math.abs(dx) + Math.abs(dy) < DRAG_SLOP && !d.moved) return;
      Object.assign(d, { moved: true, x: e.clientX, y: e.clientY });
      setView((was) => panned(was, full, dx, dy));
    },
    onPointerUp: () => setTimeout(() => (drag.current = null)),
    onPointerLeave: () => setTip(null),
  };
  return {
    box,
    view,
    tip,
    setTip,
    handlers,
    isZoomed: view !== full,
    zoom: (factor: number) => setView((was) => zoomed(was, full, factor)),
    reset: () => setView(full),
    dragged: () => drag.current?.moved === true,
  };
}

/** The gridlines and their numbers, for the window as it stands. */
function Grid({ view }: { view: View }) {
  return (
    <>
      {ticks(view.y0, view.y1, 5).map((v) => (
        <span
          key={`y${v}`}
          className="v2-bubble-grid v2-bubble-grid-y"
          style={{ bottom: place(v, view.y0, view.y1) }}
        >
          <i>{v}</i>
        </span>
      ))}
      {ticks(view.x0, view.x1, 6).map((v) => (
        <span
          key={`x${v}`}
          className="v2-bubble-grid v2-bubble-grid-x"
          style={{ left: place(v, view.x0, view.x1) }}
        >
          <i>{v}</i>
        </span>
      ))}
    </>
  );
}

/** The tooltip over the bubble under the pointer: its title, then one line each. */
function Tip({ dot, view }: { dot: BubbleDot; view: View }) {
  return (
    <div
      className="v2-bubble-tip"
      role="status"
      style={{ left: place(dot.x, view.x0, view.x1), bottom: place(dot.y, view.y0, view.y1) }}
    >
      <b>{dot.title}</b>
      {dot.tip.map((line) => (
        <span key={line}>{line}</span>
      ))}
    </div>
  );
}

/** Zoom out, zoom in and reset: the buttons beside the wheel, for those with no wheel. */
function Tools({ plot, words }: { plot: ReturnType<typeof usePlot>; words: BubbleWords }) {
  return (
    <div className="v2-bubble-tools">
      <button type="button" className="v2-btn v2-btn-ghost" onClick={() => plot.zoom(1 / FACTOR)}>
        {words.zoomOut}
      </button>
      <button type="button" className="v2-btn v2-btn-ghost" onClick={() => plot.zoom(FACTOR)}>
        {words.zoomIn}
      </button>
      <button
        type="button"
        className="v2-btn v2-btn-ghost"
        disabled={!plot.isZoomed}
        onClick={plot.reset}
      >
        {words.reset}
      </button>
    </div>
  );
}

/**
 * A bubble plot the plant can explore: hover a bubble for its tooltip, press it to open it, zoom with the buttons or
 * Ctrl and the wheel, and drag to pan. Bubbles are the engine's own figures, placed here and nothing recomputed. Drawn
 * in HTML so every label stays crisp at any width; the table beneath is the keyboard's way in, so the bubbles
 * themselves are not tab stops.
 */
export function BubblePlot({
  dots,
  words,
  onOpen,
}: {
  dots: readonly BubbleDot[];
  words: BubbleWords;
  onOpen: (dot: BubbleDot) => void;
}) {
  const plot = usePlot(dots);
  const { view } = plot;
  const shown = dots.filter((d) => inside(view, d.x, d.y));
  const active = shown.find((d) => d.id === plot.tip);
  return (
    <div className="v2-bubble">
      <Tools plot={plot} words={words} />
      <div className="v2-bubble-frame">
        <span className="v2-bubble-ytitle">{words.yLabel}</span>
        <div
          ref={plot.box}
          className="v2-bubble-plot"
          role="group"
          data-chart-state="ready"
          aria-label={words.aria}
          {...plot.handlers}
        >
          <Grid view={view} />
          {shown.map((d) => (
            <button
              key={d.id}
              type="button"
              tabIndex={-1}
              className="v2-bubble-dot"
              data-cat={d.cat}
              data-active={d.id === plot.tip ? '' : undefined}
              data-opens={d.opens ? '' : undefined}
              aria-label={`${d.title}. ${d.tip.join('. ')}`}
              style={{
                left: place(d.x, view.x0, view.x1),
                bottom: place(d.y, view.y0, view.y1),
                width: d.r * 2,
                height: d.r * 2,
              }}
              onPointerEnter={() => plot.setTip(d.id)}
              onClick={() => (!plot.dragged() && d.opens ? onOpen(d) : undefined)}
            />
          ))}
          {active ? <Tip dot={active} view={view} /> : null}
          {shown.length === 0 ? <p className="v2-sub v2-bubble-empty">{words.empty}</p> : null}
        </div>
        <span className="v2-bubble-xtitle">{words.xLabel}</span>
      </div>
    </div>
  );
}
