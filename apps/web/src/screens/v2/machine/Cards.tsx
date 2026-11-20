/* eslint-disable i18next/no-literal-string -- icon names and typed unions only; every visible word comes in as a prop or t() */
import { Button } from '../../../ui/v2/button.js';
import { DetailFigure } from '../../../ui/v2/domain/detail-parts.js';
import { Icon } from '../../../ui/v2/icons.js';
import { KeyPill } from '../../../ui/v2/key-pill.js';
import { Panel } from '../../../ui/v2/panel.js';
import { Points, Segs } from '../../../ui/v2/points.js';
import type { MachinePageWords, NextAction, PmData, SparesData } from './model.js';

/** The one thing to do, ending in its action; pressed once taken, and pressing again takes it back. */
export function NextCard({
  next,
  words,
  done,
  onAct,
  onUndo,
}: {
  next: NextAction;
  words: MachinePageWords;
  done: boolean;
  onAct: () => void;
  onUndo: () => void;
}) {
  return (
    <Panel title={words.nextTitle}>
      <h3 className="v2-h3">
        <Segs point={next.title} />
      </h3>
      {next.why.length ? <Points points={next.why} /> : null}
      {next.action ? (
        <div className="v2-row v2-gap-8">
          <button
            type="button"
            className={done ? 'v2-btn v2-btn-done' : 'v2-btn v2-btn-primary'}
            aria-pressed={done}
            onClick={done ? onUndo : onAct}
          >
            {done ? <Icon name="check" /> : null}
            {done ? next.doneText : next.action}
          </button>
          {done ? <Button onClick={onUndo}>{words.undo}</Button> : null}
        </div>
      ) : null}
    </Panel>
  );
}

/** The machine's planned maintenance: when it is next, how much this month, how often it was on the day. */
export function PmCard({ pm, title }: { pm: PmData; title: string }) {
  return (
    <Panel title={title} aside={<KeyPill {...pm.tag} />}>
      <div className="v2-figures">
        {pm.figures.map((f) => (
          <DetailFigure key={f.label} {...f} />
        ))}
      </div>
      <Points points={pm.visits} />
    </Panel>
  );
}

/** The spares its breakdowns used, and whether the shelf has them. */
export function SparesCard({ spares, title }: { spares: SparesData; title: string }) {
  return (
    <Panel title={title} aside={<KeyPill {...spares.tag} />}>
      <Points points={spares.parts} />
    </Panel>
  );
}
