import { DecisionDetail } from '../ui/v2/domain/decision-detail.js';
import type { EntityRef } from '../ui/v2/entity-chip.js';
import type { LocalEntity } from '../screens/v2/entity/EntityShell.js';
import type { DemoActions, DemoModel } from '../screens/v2/dashboard/fixture-model.js';

export type Acts = Required<DemoActions>;

/**
 * The decisions this page holds live: their drawer keeps the Decide button taking effect here. Everything else
 * (a machine, a cell, a person) is the shell's to fetch, so this answers nothing for it.
 */
export function localDecision(model: DemoModel, ref: EntityRef, act: Acts): LocalEntity | null {
  const d = ref.kind === 'decision' ? model.decisions.find((x) => x.id === ref.id) : undefined;
  if (!d) return null;
  const { words, source } = model;
  return {
    label: d.title,
    content: (
      <DecisionDetail
        d={d}
        words={words.decisionDetail}
        source={source}
        onDecide={act.onDecide}
        onUndo={act.onUndo}
      />
    ),
  };
}
