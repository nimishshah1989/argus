import { createContext, useContext } from 'react';
import { Icon, type IconName } from './icons.js';
import type { SegmentKey } from './segment.js';

/** The four things a screen names: a machine, a cell, a person, a decision. */
export type EntityKind = 'machine' | 'cell' | 'person' | 'decision';
export type EntityRef = { kind: EntityKind; id: string };
export type EntityChipProps = EntityRef & {
  /** What the chip prints: a machine's code, or a name. */
  label: string;
  /** A machine's type colour, 1 to 5. */
  cat?: number;
  /**
   * A machine's segment (ADR 0036 R23), printed as `data-seg`; the chip colour then follows the segment. With `seg`
   * set the chip carries no `data-cat` (seg wins over cat).
   */
  seg?: SegmentKey;
};

const ICON: Record<EntityKind, IconName> = {
  machine: 'machines',
  cell: 'cell',
  person: 'person',
  decision: 'decision',
};

/**
 * What a chip does when pressed. The screen's shell provides it (it opens that thing in the drawer); with no shell
 * around, as in a test, a chip does nothing.
 */
export const EntityOpenContext = createContext<(ref: EntityRef) => void>(() => {});

/**
 * Every machine, cell, person or decision a screen names, in text, rows and tables alike: its icon and its name. A
 * machine is its code in Geist Mono wearing its type's colour. It is a button, so it works inside a clickable row:
 * the click opens the chip's thing and goes no further.
 */
export function EntityChip({ kind, id, label, cat, seg }: EntityChipProps) {
  const open = useContext(EntityOpenContext);
  return (
    <button
      type="button"
      className={kind === 'machine' ? 'v2-entity v2-code' : 'v2-entity'}
      data-kind={kind}
      data-cat={seg ? undefined : cat}
      data-seg={seg}
      onClick={(e) => {
        e.stopPropagation();
        open({ kind, id });
      }}
    >
      <Icon name={ICON[kind]} size={12} />
      <span className="v2-entity-label">{label}</span>
    </button>
  );
}
