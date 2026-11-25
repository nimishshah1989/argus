import { EntityChip } from '../entity-chip.js';
import { EventStrip } from '../event-strip.js';
import { KeyPill } from '../key-pill.js';
import { Points, Segs } from '../points.js';
import {
  DecisionAction,
  KIND_TONE,
  type DecisionCallbacks,
  type DecisionData,
} from './decision-row.js';
import { DetailFigure, DetailSection, SourceLine, type FullPage } from './detail-parts.js';

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
}: {
  d: DecisionData;
  words: DecisionDetailWords;
  source: string;
  /** The entity's full page (ADR 0036 R24): drawn once as `FullPageLink` just above the source line; absent → no link. */
  full?: FullPage;
} & Partial<DecisionCallbacks>) {
  return (
    <div className="v2-detail">
      <div className="v2-row v2-gap-8">
        <KeyPill text={d.kindLabel} tone={KIND_TONE[d.kind]} />
        {d.codes.map((c) => (
          <EntityChip key={c.id} {...c} />
        ))}
      </div>
      <h2 className="v2-drawer-title">{d.title}</h2>
      <p className="v2-sub">
        <Segs point={d.owner} />
      </p>
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
      {act.onDecide && act.onUndo ? (
        <div className="v2-row v2-gap-8">
          <DecisionAction d={d} onDecide={act.onDecide} onUndo={act.onUndo} />
        </div>
      ) : null}
      <SourceLine text={source} />
    </div>
  );
}
