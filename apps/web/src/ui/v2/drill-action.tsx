/* eslint-disable i18next/no-literal-string -- icon names only; the visible word is the drill label */
import { useContext } from 'react';
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
