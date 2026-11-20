import type { NudgeRule, NudgeSeverity, NudgeStatus } from '@uptimo/shared';
import type { ActionCenterModel, NudgeCard } from './model.js';

/** What the reader has asked of the nudges: a status tab, a priority, a type and a search. */
export type Filters = {
  status: NudgeStatus;
  severity: NudgeSeverity | '';
  rule: NudgeRule | '';
  query: string;
};

/** The cards the tab, priority, type and search leave, in the engine's order: a stable filter, never a sort. */
export function keep(model: Pick<ActionCenterModel, 'nudges'>, filters: Filters): NudgeCard[] {
  const needle = filters.query.trim().toLowerCase();
  return model.nudges.filter((card) => {
    if (card.status !== filters.status) return false;
    if (filters.severity !== '' && card.severity !== filters.severity) return false;
    if (filters.rule !== '' && card.rule !== filters.rule) return false;
    if (needle === '') return true;
    return `${card.title} ${card.machines.map((machine) => machine.label).join(' ')}`
      .toLowerCase()
      .includes(needle);
  });
}
