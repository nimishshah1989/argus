import { EntityChip, type EntityChipProps } from '../entity-chip.js';
import { KeyPill } from '../key-pill.js';
import { DetailFigure, DetailSection, SourceLine } from './detail-parts.js';
import { STATE_ICON, STATE_TONE, type MachineState } from './plant.js';

/** A cell as its drawer prints it: every figure and word ready, the machines that matter as chips. */
export type CellDetailData = {
  name: string;
  /** "15 machines". */
  machineCount: string;
  /** How many machines are in each state, worst first, one printed part each ("2 down"); empty states are left out. */
  mix: { state: MachineState; text: string }[];
  /** This month's breakdown hours across the cell: the engine's figure, and the number that sorts it. */
  hours: { shown: string; value: number };
  /** The machines that cost the most hours this month, worst first, each with its hours. */
  worst: { chip: EntityChipProps; hours: string }[];
};

export type CellDetailWords = { now: string; figures: string; hours: string; worst: string };

/** A cell in full, in the drawer: its machines by state, this month's breakdown hours, and its worst machines. */
export function CellDetail({
  c,
  words,
  source,
}: {
  c: CellDetailData;
  words: CellDetailWords;
  source: string;
}) {
  return (
    <div className="v2-detail">
      <div className="v2-row v2-gap-8">
        <KeyPill text={c.machineCount} tone="neutral" />
      </div>
      <h2 className="v2-drawer-title">{c.name}</h2>
      <DetailSection label={words.now}>
        <div className="v2-row v2-gap-6">
          {c.mix.map((m) => (
            <KeyPill
              key={m.state}
              text={m.text}
              tone={STATE_TONE[m.state]}
              icon={STATE_ICON[m.state]}
            />
          ))}
        </div>
      </DetailSection>
      <DetailSection label={words.figures}>
        <div className="v2-figures">
          <DetailFigure label={words.hours} value={c.hours.shown} />
        </div>
      </DetailSection>
      {c.worst.length > 0 ? (
        <DetailSection label={words.worst}>
          {c.worst.map((w) => (
            <div key={w.chip.id} className="v2-row v2-gap-8">
              <EntityChip {...w.chip} />
              <span className="v2-sub v2-num">{w.hours}</span>
            </div>
          ))}
        </DetailSection>
      ) : null}
      <SourceLine text={source} />
    </div>
  );
}
