import { DecisionDetail } from '../../../ui/v2/domain/decision-detail.js';
import type { EntityRef } from '../../../ui/v2/entity-chip.js';
import type { LocalEntity } from '../entity/EntityShell.js';
import type { ActionCenterActions, ActionCenterModel } from './model.js';

export type Acts = Required<ActionCenterActions>;

/**
 * Every decision this page holds, waiting or not, opens here with its full story. A waiting one keeps its Decide
 * button taking effect on this page; a parked or settled one has none. A machine, cell or person is the shell's.
 */
export function localDecision(
  model: ActionCenterModel,
  ref: EntityRef,
  act: Acts,
): LocalEntity | null {
  if (ref.kind !== 'decision') return null;
  const live = model.decisions.find((x) => x.id === ref.id);
  const d = live ?? model.settled.find((x) => x.decision.id === ref.id)?.decision;
  if (!d) return null;
  const { words, source } = model;
  return {
    label: d.title,
    content: (
      <DecisionDetail
        d={d}
        words={words.decisionDetail}
        source={source}
        onDecide={live ? act.onDecide : undefined}
        onUndo={live ? act.onUndo : undefined}
      />
    ),
  };
}
