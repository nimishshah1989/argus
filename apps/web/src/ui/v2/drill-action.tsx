import { useContext, type ReactNode } from 'react';
import { Button } from './button.js';
import { DrillOpenContext, type Drill } from './drill.js';

/**
 * The control that opens the rows behind a whole page or section, for a figure that v1 linked from the page and not
 * from a count (a count's own figure carries `drill` instead). Its words are the drill's own label.
 */
export function DrillAction({ drill }: { drill: Drill }) {
  const open = useContext(DrillOpenContext);
  return <Button onClick={() => open(drill)}>{drill.label}</Button>;
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
