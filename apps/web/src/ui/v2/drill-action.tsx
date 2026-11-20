/* eslint-disable i18next/no-literal-string -- icon names only; the visible word is the drill label */
import { useContext, type ReactNode } from 'react';
import { DrillOpenContext, type Drill } from './drill.js';
import { Icon } from './icons.js';

/**
 * A page's own control for the rows behind it: for a page whose cards each count something narrower than the rows the
 * engine named (one register, one age band), so the rows open from the page and not from a count they do not equal.
 */
export function DrillAction({ drill }: { drill: Drill }) {
  const open = useContext(DrillOpenContext);
  return (
    <p className="v2-drill-action">
      <button type="button" className="v2-btn v2-btn-ghost" onClick={() => open(drill)}>
        <Icon name="list" size={16} />
        {drill.label}
      </button>
    </p>
  );
}

/** A titled part of a screen that is not itself a card: its title and one quiet line, an action at the right, then its content. */
export function Section({
  title,
  sub,
  action,
  children,
}: {
  title: string;
  sub?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="v2-section" aria-label={title}>
      <div className="v2-section-head">
        <div>
          <h2 className="v2-h2">{title}</h2>
          {sub ? <p className="v2-sub">{sub}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
