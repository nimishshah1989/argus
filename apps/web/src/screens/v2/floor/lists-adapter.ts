import type { TFunction } from 'i18next';
import type { Machine, Me, Ticket } from '../../../api.js';
import type { Refusal } from '../../../components/signoff.js';
import type { ViewState } from '../../../patterns/view-state.js';
import type { CancelModel, DisputeModel, MineModel, PmModel } from './lists-model.js';

/** What both lists read besides their rows: the login (role, acting person), the plant's machines, and now. */
export type ListsContext = {
  me: Me;
  machines: readonly Machine[];
  nowIso: string;
  /** From `viewState({ online, hasData, isEmpty, error })`. */
  state: ViewState;
  /** The list query's paging: whether another page exists and whether it is being fetched. */
  paging: { hasNext: boolean; fetching: boolean };
  /** The last "Is it fixed?" answer this phone sent (one at a time): in flight, or refused. Absent = none. */
  answer?: { ticketId: string; pending: boolean; refusal: Refusal | null } | null;
};

/**
 * `/floor/mine` from the loaded `/tickets?raisedBy=actingPersonId` rows (newest first, as sent). Card words, pill,
 * sign-off block and Cancel follow `lists-model.ts`; times are v1's `clock()` (`faces/floor/use-floor.ts`).
 */
export function mineModel(_rows: readonly Ticket[], _ctx: ListsContext, _t: TFunction): MineModel {
  throw new Error('not implemented');
}

/** `/floor/pm` from the loaded `/tickets?channel=pm&status=open,working` rows; each card links to `/desk/:id`. */
export function pmModel(_rows: readonly Ticket[], _ctx: ListsContext, _t: TFunction): PmModel {
  throw new Error('not implemented');
}

/** The "Not fixed" sheet for one ticket: the typed reason, the last refusal, whether a send is in flight. */
export function disputeModel(
  _ticket: Ticket,
  _input: { reason: string; refusal: Refusal | null; pending: boolean },
  _t: TFunction,
): DisputeModel {
  throw new Error('not implemented');
}

/** The "Cancel the ticket" sheet for one ticket: the typed reason, the command's error, whether one is in flight. */
export function cancelModel(
  _ticket: Ticket,
  _input: { reason: string; error: string | null; pending: boolean },
  _t: TFunction,
): CancelModel {
  throw new Error('not implemented');
}
