import type { FocusNoteBody } from '@uptimo/shared/team-focus-notes';
import { OWNER_PREFIX, STORED_OF } from './adapter.js';
import type { ActionRow, NoteChange, TeamFocusModel } from './model.js';

/**
 * Team Focus writes (TF-3, ADR 0020): the body of one `PUT /analytics/team-focus/notes`, built from what the screen
 * shows now and the one change asked for, so a save never blanks a field it did not touch.
 */

/**
 * The body that saves `change` on action `actionId` of the month `period`: the row's current status (stored word, via
 * `STORED_OF`), owner (the chip's label, or '') and note, with `change` laid over them. Null when no such action.
 */
export function noteBody(
  model: TeamFocusModel,
  period: string,
  actionId: string,
  change: NoteChange,
): FocusNoteBody | null {
  const row = model.actions.find((a) => a.id === actionId);
  if (!row) return null;
  return {
    period,
    action: actionId,
    status: STORED_OF[change.status ?? row.status],
    owner: change.owner ?? row.owner?.label ?? '',
    note: change.note ?? row.note,
  };
}

/** How many of the action's lane (same `kindLabel`) are still open (todo or doing), of how many; null when no such action. */
export function laneTally(
  model: TeamFocusModel,
  actionId: string,
): { open: number; total: number } | null {
  const row = model.actions.find((a) => a.id === actionId);
  if (!row) return null;
  const lane = model.actions.filter((a) => a.kindLabel === row.kindLabel);
  const open = lane.filter((a) => a.status === 'todo' || a.status === 'doing');
  return { open: open.length, total: lane.length };
}

/** The actions an owner chip (`owner:<text>`) stands for, in the model's order; none for any other id. */
export function ownerRows(model: TeamFocusModel, chipId: string): ActionRow[] {
  return chipId.startsWith(OWNER_PREFIX) ? model.actions.filter((a) => a.owner?.id === chipId) : [];
}
