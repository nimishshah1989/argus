import { CellDetail } from '../../../ui/v2/domain/cell-detail.js';
import { DecisionDetail } from '../../../ui/v2/domain/decision-detail.js';
import { MachineDetail } from '../../../ui/v2/domain/machine-detail.js';
import { PersonDetail } from '../../../ui/v2/domain/person-detail.js';
import type { EntityModel } from './model.js';

/**
 * The drawer's content for what the port sent. A decision here has no Decide button: a screen that holds decisions
 * live supplies its own, with the button, through `EntityShell`'s `local`.
 */
export function EntityDetail({ model }: { model: EntityModel }) {
  switch (model.kind) {
    case 'machine':
      return <MachineDetail m={model.machine} words={model.words} source={model.source} />;
    case 'cell':
      return <CellDetail c={model.cell} words={model.words} source={model.source} />;
    case 'person':
      return <PersonDetail p={model.person} words={model.words} source={model.source} />;
    case 'decision':
      return (
        <DecisionDetail d={model.decision} words={model.words} source={model.source} />
      );
  }
}
