/* eslint-disable i18next/no-literal-string -- icon names and typed unions only; every visible word comes in as a prop */
import { EntityChip, type EntityChipProps } from '../entity-chip.js';
import { KeyPill } from '../key-pill.js';

/** One measure of a comparison as one side prints it: the figure, and who has the better of it. */
export type CompareFigure = {
  id: string;
  label: string;
  /** One quiet line on what the figure counts. */
  hint: string;
  /** The figure exactly as the engine printed it. */
  value: string;
  /** Whether this side has the better figure, the worse one, or about the same. */
  mark: 'better' | 'worse' | 'same';
  /** What the mark says in words: "Better", "2.7× more", "About the same". */
  markText: string;
};

export type CompareBoxData = {
  /** The thing compared, as a chip that opens it. */
  chip: EntityChipProps;
  /** One quiet line under it: type, cell, age. */
  sub: string;
  figures: CompareFigure[];
};

const MARK_TONE = { better: 'gain', worse: 'loss', same: 'neutral' } as const;

/**
 * One side of a comparison. Two boxes in a `Row` carry the same figures in the same order, so each line sits level
 * with its twin; the biggest difference is on top. The mark says who is ahead in words and an icon, not colour alone.
 */
export function CompareBox({ box }: { box: CompareBoxData }) {
  return (
    <section className="v2-card v2-pad v2-compare" aria-label={box.chip.label}>
      <div className="v2-card-head">
        <div>
          <h2 className="v2-h2">
            <EntityChip {...box.chip} />
          </h2>
          <p className="v2-sub">{box.sub}</p>
        </div>
      </div>
      <ul className="v2-compare-list">
        {box.figures.map((f) => (
          <li key={f.id} className="v2-compare-row">
            <div>
              <div className="v2-compare-label">{f.label}</div>
              <div className="v2-sub">{f.hint}</div>
            </div>
            <span className="v2-num v2-compare-value">{f.value}</span>
            <KeyPill
              text={f.markText}
              tone={MARK_TONE[f.mark]}
              icon={f.mark === 'better' ? 'check' : f.mark === 'worse' ? 'alert' : undefined}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
