import { EventStrip } from '../event-strip.js';
import { KeyPill } from '../key-pill.js';
import { Points } from '../points.js';
import {
  DecisionAction,
  KIND_TONE,
  type DecisionCallbacks,
  type DecisionData,
} from './decision-row.js';
import { DetailFigure, DetailSection, SourceLine } from './detail-parts.js';

export type DecisionDetailWords = {
  worth: string;
  perMonth: string;
  perYear: string;
  last90: string;
  stripCaption: string;
  why: string;
};

/** A decision in full, in the drawer: what, what it is worth, its 90 days, the whole story, and the action. */
export function DecisionDetail({
  d,
  words,
  source,
  ...act
}: { d: DecisionData; words: DecisionDetailWords; source: string } & DecisionCallbacks) {
  return (
    <div className="v2-detail">
      <div className="v2-row v2-gap-8">
        <KeyPill text={d.kindLabel} tone={KIND_TONE[d.kind]} />
        {d.codes.map((c) => (
          <span key={c} className="v2-code">
            {c}
          </span>
        ))}
      </div>
      <h2 className="v2-drawer-title">{d.title}</h2>
      <p className="v2-sub">{d.owner}</p>
      <DetailSection label={words.worth}>
        <div className="v2-figures">
          <DetailFigure label={words.perMonth} value={d.hours} />
          <DetailFigure label={words.perYear} value={d.money} />
        </div>
      </DetailSection>
      <DetailSection label={words.last90}>
        <EventStrip days={d.days} label={d.stripLabel} caption={words.stripCaption} />
      </DetailSection>
      <DetailSection label={words.why}>
        <Points points={d.detail} />
      </DetailSection>
      <div className="v2-row v2-gap-8">
        <DecisionAction d={d} {...act} />
      </div>
      <SourceLine text={source} />
    </div>
  );
}
