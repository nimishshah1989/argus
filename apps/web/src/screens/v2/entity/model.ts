import type { CellDetailData, CellDetailWords } from '../../../ui/v2/domain/cell-detail.js';
import type { DecisionDetailWords } from '../../../ui/v2/domain/decision-detail.js';
import type { DecisionData } from '../../../ui/v2/domain/decision-row.js';
import type { MachineDetailWords } from '../../../ui/v2/domain/machine-detail.js';
import type { MachineData } from '../../../ui/v2/domain/plant.js';
import type { PersonDetailData, PersonDetailWords } from '../../../ui/v2/domain/person-detail.js';

/**
 * Everything a drawer prints for one machine, cell, person or decision: the contract the API fills. `id` is what the
 * URL and the chips say, `label` names the drawer for a screen reader, and `source` is the figures' freshness line.
 * A model that is not found comes back as nothing, never as a model with holes.
 */
export type EntityModel = { id: string; label: string; source: string } & (
  | { kind: 'machine'; machine: MachineData; words: MachineDetailWords }
  | { kind: 'decision'; decision: DecisionData; words: DecisionDetailWords }
  | { kind: 'cell'; cell: CellDetailData; words: CellDetailWords }
  | { kind: 'person'; person: PersonDetailData; words: PersonDetailWords }
);
