import { useId, type ReactNode } from 'react';
import { StateNotice } from '../../../../patterns/frame.js';
import './templates.css';

/** Regions every template has. The phone shows them in this order, in one column. */
interface Regions {
  /** The drill trail (where you are in a drill-down), above the title. */
  trail?: ReactNode;
  title: string;
  /** One line under the title: the period, or the question the screen answers. */
  lede?: string;
  /** Header controls: period picker, export. They wrap under the title on a phone. */
  actions?: ReactNode;
  /** The filter row. It stays while the body loads, so the period can still be changed. */
  filters?: ReactNode;
  /** The figure tiles: 2 a row on a phone, 4 to 6 on a wide screen. */
  figures?: ReactNode;
  main: ReactNode;
  /** The drill area: a panel under the content, or beside it on a register and a work queue. */
}

/** A drill area is always named: its heading labels the region. */
type DrillProps =
  { drill?: undefined; drillTitle?: never } | { drill: ReactNode; drillTitle: string };

/**
 * Anything but 'ready' replaces figures, main, aside and drill with the state line. An empty page needs the
 * screen's own words and an error needs the Retry action, so the type asks for them.
 */
type StateProps =
  | { state?: 'ready' | 'loading' | 'offline'; empty?: never; onRetry?: never }
  | { state: 'empty'; empty: string; onRetry?: never }
  | { state: 'error'; onRetry: () => void; empty?: never };

/**
 * The five templates (ticket 85): overview (tiles over a grid of charts), analysis (a chart with its ranking
 * beside it), register (a long table, its drill beside it), entity (one thing, its facts and history beside) and
 * work queue (a list, the item beside it). Only analysis and entity take `aside`; the type says so.
 */
export type TemplateProps = Regions &
  DrillProps &
  StateProps &
  (
    | { kind: 'overview' | 'register' | 'queue'; aside?: never }
    | { kind: 'analysis' | 'entity'; aside?: ReactNode }
  );

const noRetry = () => {};

/** Which region sits beside the content on a wide screen; the rest stack full width. */
function sideOf(p: TemplateProps): 'aside' | 'drill' | undefined {
  if (p.kind === 'register' || p.kind === 'queue') return p.drill ? 'drill' : undefined;
  return p.aside ? 'aside' : undefined;
}

/**
 * The frame an analytics screen drops its content into. It owns the order, the spacing and the phone layout;
 * the screen owns the words and the elements. It answers to its own width, not the window's, so it is right
 * beside the shell's left menu too.
 */
export function Template(p: TemplateProps) {
  const headingId = useId();
  const drillId = useId();
  const state = p.state ?? 'ready';
  return (
    <div className="at" data-testid="template" data-template={p.kind} data-state={state}>
      <div className="at-grid" data-side={sideOf(p)}>
        {p.trail ? <div className="at-trail">{p.trail}</div> : null}
        <header className="at-head">
          <div className="at-head-text">
            <h2 id={headingId}>{p.title}</h2>
            {p.lede ? <p>{p.lede}</p> : null}
          </div>
          {p.actions ? <div className="at-actions">{p.actions}</div> : null}
        </header>
        {p.filters ? <div className="at-filters">{p.filters}</div> : null}
        {state === 'ready' ? (
          <>
            {p.figures ? <div className="at-figures">{p.figures}</div> : null}
            <div className="at-main">{p.main}</div>
            {p.aside ? <aside className="at-aside">{p.aside}</aside> : null}
            {p.drill ? (
              <section className="at-drill" aria-labelledby={drillId}>
                <h3 id={drillId}>{p.drillTitle}</h3>
                {p.drill}
              </section>
            ) : null}
          </>
        ) : (
          <div className="at-notice">
            <StateNotice state={state} empty={p.empty ?? ''} onRetry={p.onRetry ?? noRetry} />
          </div>
        )}
      </div>
    </div>
  );
}
