import type { ReactNode } from 'react';
import type { CancelModel, DisputeModel, MineModel, PmModel } from './lists-model.js';

/**
 * Draws the floor lists inside #767's `FloorFrame` (tabs, Account, Drafts). Page order is pinned by
 * `e2e/gallery/floor-order-lists.ts` (`MINE`, `MINE_TECH`, `DISPUTE`, `CANCEL`, `PM`): title `h2`, then per card
 * Cancel, then `h3` "Is it fixed?" with "Yes, it is fixed" / "Not fixed"; no `h1`, no extra button or link.
 * Reuses `MachineCard` (`ui/floor-pieces`), `StatusPill`, `Button`, `Sheet`, `Label`/`Textarea`, `PatternFrame`/`StateNotice`,
 * and the kit `Takeaway` (`ui/v2/takeaway`).
 */

export type MineActions = {
  more: () => void;
  cancel: (ticketId: string) => void;
  yes: (ticketId: string) => void;
  no: (ticketId: string) => void;
};

/** `/floor/mine`: takeaway, then each card as a list item (`li`) carrying its REF, then Load more. */
export function MineView(_props: { model: MineModel; on: MineActions }): ReactNode {
  throw new Error('not implemented');
}

/** `/floor/pm`: takeaway and hint, then each job as one link to `/desk/:id`, then Load more. */
export function PmJobsView(_props: { model: PmModel; on: { more: () => void } }): ReactNode {
  throw new Error('not implemented');
}

export type SheetActions = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reason: (text: string) => void;
  send: () => void;
};

/** The "Not fixed" sheet (dialog "Not fixed"): note, "What is still wrong?" (maxlength), Send back, Cancel. */
export function DisputeSheetView(_props: { model: DisputeModel; on: SheetActions }): ReactNode {
  throw new Error('not implemented');
}

/** The "Cancel the ticket" sheet: "Why cancel?", the error, "Cancel ticket". */
export function CancelSheetView(_props: { model: CancelModel; on: SheetActions }): ReactNode {
  throw new Error('not implemented');
}
