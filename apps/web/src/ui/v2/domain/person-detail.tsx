import { EntityChip, type EntityChipProps } from '../entity-chip.js';
import { DetailFigure, DetailSection, SourceLine } from './detail-parts.js';

/** A person as their drawer prints it: what they are on now as chips, and this month in figures ready to print. */
export type PersonDetailData = {
  name: string;
  role: string;
  /** The decisions and machines they are on now, each with one line on what they are doing. */
  now: { chip: EntityChipProps; note: string }[];
  /** This month: the jobs they closed and the hours they worked. */
  jobs: string;
  hours: string;
};

export type PersonDetailWords = {
  now: string;
  /** Said when they are on nothing. */
  free: string;
  month: string;
  jobs: string;
  hours: string;
};

/** A person in full, in the drawer: their role, what they are on now, and this month's jobs and hours. */
export function PersonDetail({
  p,
  words,
  source,
}: {
  p: PersonDetailData;
  words: PersonDetailWords;
  source: string;
}) {
  return (
    <div className="v2-detail">
      <h2 className="v2-drawer-title">{p.name}</h2>
      <p className="v2-sub">{p.role}</p>
      <DetailSection label={words.now}>
        {p.now.length === 0 ? <p className="v2-sub">{words.free}</p> : null}
        {p.now.map((n) => (
          <div key={`${n.chip.kind}:${n.chip.id}`} className="v2-row v2-gap-8">
            <EntityChip {...n.chip} />
            <span className="v2-sub">{n.note}</span>
          </div>
        ))}
      </DetailSection>
      <DetailSection label={words.month}>
        <div className="v2-figures">
          <DetailFigure label={words.jobs} value={p.jobs} />
          <DetailFigure label={words.hours} value={p.hours} />
        </div>
      </DetailSection>
      <SourceLine text={source} />
    </div>
  );
}
