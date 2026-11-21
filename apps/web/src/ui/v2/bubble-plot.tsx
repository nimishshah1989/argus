import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type PointerEvent,
} from 'react';
import { fullView, inside, ticks, type View } from './bubble-math.js';
import { plotReducer } from './bubble-state.js';

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
/** The least space left between a tooltip and the window's edge, in pixels. */
const TIP_MARGIN = 8;

const place = (v: number, lo: number, hi: number) =>
  `${(((v - lo) / (hi - lo)) * 100).toFixed(2)}%`;

/**
 * The window, the zoom and pan that move it, and the tooltip's bubble: everything the plot keeps. The window lives in a
 * reducer apart from the dots, so a refresh that brings the same data again leaves the zoom where the reader put it;
 * `resetKey` (the filters) starts the whole picture again when what is plotted changes.
 */
function usePlot(dots: readonly BubbleDot[], resetKey: string) {
  const { x1, y1 } = fullView(dots);
  // By value: a refresh builds new dots but not a new picture.
  const full = useMemo<View>(() => ({ x0: 0, x1, y0: 0, y1 }), [x1, y1]);
  const [state, dispatch] = useReducer(plotReducer, { view: null, key: resetKey });
  const [tip, setTip] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  if (state.key !== resetKey) dispatch({ type: 'key', key: resetKey });
  const fullRef = useRef(full);
  fullRef.current = full;
  // Ctrl or Cmd and the wheel (a trackpad pinch is the same) zoom the plot and never the page: a native listener, because
  // React's wheel handler is passive and cannot stop the browser zooming.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      if (r.width === 0) return;
      const at = { x: (e.clientX - r.left) / r.width, y: 1 - (e.clientY - r.top) / r.height };
      dispatch({
        type: 'zoom',
        factor: e.deltaY > 0 ? 1 / FACTOR : FACTOR,
        at,
        full: fullRef.current,
      });
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  }, []);
  const handlers = {
    onPointerDown: (e: PointerEvent) => {
      drag.current = { x: e.clientX, y: e.clientY, moved: false };
    },
    onPointerMove: (e: PointerEvent) => {
      const d = drag.current;
      const r = box.current?.getBoundingClientRect();
      if (!d || !r || r.width === 0 || (e.buttons & 1) === 0) return;
      const [dx, dy] = [(e.clientX - d.x) / r.width, -(e.clientY - d.y) / r.height];
      if (Math.abs(dx) + Math.abs(dy) < DRAG_SLOP && !d.moved) return;
      Object.assign(d, { moved: true, x: e.clientX, y: e.clientY });
      dispatch({ type: 'pan', dx, dy, full });
    },
    onPointerUp: () => setTimeout(() => (drag.current = null)),
    onPointerLeave: () => setTip(null),
  };
  return {
    box,
    view: state.view ?? full,
    tip,
    setTip,
    handlers,
    isZoomed: state.view !== null,
    zoom: (factor: number) => dispatch({ type: 'zoom', factor, full }),
    reset: () => dispatch({ type: 'reset' }),
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

/**
 * The tooltip over the bubble under the pointer: its title, then one line each. Past the middle of the plot it opens to
 * the left of the bubble, so it never runs out of the page. Not a live region (it would announce every hover); the
 * bubble's own label carries the same lines.
 */
function Tip({ dot, view }: { dot: BubbleDot; view: View }) {
  const left = (dot.x - view.x0) / (view.x1 - view.x0) > 0.5;
  const box = useRef<HTMLDivElement>(null);
  // Whatever side it opens on, a long line (a machine type's full name) must not leave the window: measure it, and
  // shift it back by the overhang.
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.setProperty('--v2-tip-shift', '0px');
    const r = el.getBoundingClientRect();
    const edge = document.documentElement.clientWidth - TIP_MARGIN;
    const shift = r.right > edge ? edge - r.right : r.left < TIP_MARGIN ? TIP_MARGIN - r.left : 0;
    el.style.setProperty('--v2-tip-shift', `${shift}px`);
  });
  return (
    <div
      ref={box}
      className={left ? 'v2-bubble-tip v2-bubble-tip-left' : 'v2-bubble-tip'}
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
 * themselves are not tab stops (the machines table beneath carries the same numbers for every machine).
 */
export function BubblePlot({
  dots,
  words,
  onOpen,
  resetKey,
}: {
  dots: readonly BubbleDot[];
  words: BubbleWords;
  onOpen: (dot: BubbleDot) => void;
  /** What is plotted, as text (the filters): when it changes the picture starts again from the whole. */
  resetKey: string;
}) {
  const plot = usePlot(dots, resetKey);
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
