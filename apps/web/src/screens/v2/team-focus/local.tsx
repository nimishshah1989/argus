import { DecisionDetail } from '../../../ui/v2/domain/decision-detail.js';
import type { EntityRef } from '../../../ui/v2/entity-chip.js';
import type { LocalEntity } from '../entity/EntityShell.js';
import type { TeamFocusActions, TeamFocusModel } from './model.js';

export type Acts = Required<TeamFocusActions>;

/**
 * The actions waiting for an owner, held live: their drawer keeps its Assign button taking effect here. A machine,
 * cell or person is the shell's to fetch, so this answers nothing for them.
 */
export function localAction(model: TeamFocusModel, ref: EntityRef, act: Acts): LocalEntity | null {
  const d = ref.kind === 'decision' ? model.start.find((x) => x.id === ref.id) : undefined;
  if (!d) return null;
  return {
    label: d.title,
    content: (
      <DecisionDetail
        d={d}
        words={model.words.decisionDetail}
        source={model.source}
        onDecide={act.onAssign}
        onUndo={act.onUnassign}
      />
    ),
  };
}
