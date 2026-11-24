import { DecisionDetail } from '../../../ui/v2/domain/decision-detail.js';
import type { EntityRef } from '../../../ui/v2/entity-chip.js';
import type { LocalEntity } from '../entity/EntityShell.js';
import { OWNER_PREFIX } from './adapter.js';
import { ActionDetail, OwnerDetail } from './detail.js';
import type { TeamFocusActions, TeamFocusModel } from './model.js';

/** "I'll take it" is absent until the signed-in person and the month are known (ticket 594), so its two are optional. */
export type Acts = Omit<Required<TeamFocusActions>, 'onAssign' | 'onUnassign'> &
  Pick<TeamFocusActions, 'onAssign' | 'onUnassign'>;

/**
 * The drawers this page holds live: a start decision keeps its Assign button, any other action of the month opens its
 * edit form, an owner (free text, `owner:<name>`) lists what they hold. A machine, cell or real person is the shell's
 * to fetch, so this answers nothing for them.
 */
export function localAction(
  model: TeamFocusModel,
  ref: EntityRef,
  act: Acts,
  canSave = true,
): LocalEntity | null {
  // Never null for an owner: null would send `owner:` to the person lookup, and an owner with no actions is still one.
  if (ref.kind === 'person' && ref.id.startsWith(OWNER_PREFIX)) {
    return {
      label: ref.id.slice(OWNER_PREFIX.length),
      content: <OwnerDetail model={model} chipId={ref.id} />,
    };
  }
  if (ref.kind !== 'decision') return null;
  const d = model.start.find((x) => x.id === ref.id);
  if (d)
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
  const row = model.actions.find((a) => a.id === ref.id);
  if (!row) return null;
  return {
    label: row.title,
    content: (
      <ActionDetail
        model={model}
        row={row}
        canSave={canSave}
        onSave={(change) => act.onSave(row.id, change)}
      />
    ),
  };
}
