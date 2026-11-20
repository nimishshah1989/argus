import { KeyPill } from '../key-pill.js';
import { Points } from '../points.js';
import { Sparkline } from '../sparkline.js';
import { DetailFigure, DetailSection, SourceLine } from './detail-parts.js';
import { trendTone, STATE_ICON, STATE_TONE, type MachineData, type MachineState } from './plant.js';

export type MachineDetailWords = {
  states: Record<MachineState, string>;
  figures: string;
  hours: string;
  stops: string;
  trend: string;
  why: string;
};

/** A machine in full, in the drawer: its state and why, this month's hours, its breakdowns, its 12-week trend. */
export function MachineDetail({
  m,
  words,
  source,
}: {
  m: MachineData;
  words: MachineDetailWords;
  source: string;
}) {
  return (
    <div className="v2-detail">
      <div className="v2-row v2-gap-8">
        <KeyPill
          text={words.states[m.state]}
          tone={STATE_TONE[m.state]}
          icon={STATE_ICON[m.state]}
        />
        <span className="v2-code" data-cat={m.cat}>
          {m.code}
        </span>
      </div>
      <h2 className="v2-drawer-title">{m.name}</h2>
      <p className="v2-sub">
        {m.typeLabel} · {m.cell}
      </p>
      <DetailSection label={words.why}>
        <Points points={m.why} />
      </DetailSection>
      <DetailSection label={words.figures}>
        <div className="v2-figures">
          <DetailFigure label={words.hours} value={m.hours.shown} />
          <DetailFigure label={words.stops} value={String(m.stops)} />
        </div>
      </DetailSection>
      <DetailSection label={words.trend}>
        <Sparkline values={m.trend} tone={trendTone(m.trend)} width={360} height={56} draw />
      </DetailSection>
      <SourceLine text={source} />
    </div>
  );
}
