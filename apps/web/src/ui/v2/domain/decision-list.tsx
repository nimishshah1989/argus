import { fill } from '../../../i18n/fill.js';
import { Panel } from '../panel.js';
import {
  DecisionRow,
  type DecisionCallbacks,
  type DecisionData,
  type DecisionWords,
} from './decision-row.js';

export type DecisionListWords = DecisionWords & {
  title: string;
  /** `{n}` waiting, before any is decided. */
  waiting: string;
  /** `{n}` of `{total}` decided. */
  done: string;
};

/** The decisions in the order given (biggest first), under a count that is announced whenever it changes. */
export function DecisionList({
  decisions,
  words,
  selected,
  onOpen,
  ...act
}: {
  decisions: DecisionData[];
  words: DecisionListWords;
  selected?: string;
  onOpen: (id: string) => void;
} & Partial<DecisionCallbacks>) {
  const decided = decisions.filter((d) => d.decided).length;
  const count = decided
    ? fill(words.done, { n: decided, total: decisions.length })
    : fill(words.waiting, { n: decisions.length });
  const aside = (
    <span className="v2-sub v2-num" aria-live="polite" aria-atomic="true">
      {count}
    </span>
  );
  return (
    <Panel title={words.title} flush aside={aside}>
      {decisions.map((d) => (
        <DecisionRow
          key={d.id}
          d={d}
          words={words}
          selected={d.id === selected}
          onOpen={onOpen}
          {...act}
        />
      ))}
    </Panel>
  );
}
