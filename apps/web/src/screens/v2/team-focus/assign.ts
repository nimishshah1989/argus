/** Ticket 594: "I'll take it" handlers; absent until the signed-in person and the month are both known. */
export type AssignHandlers = { onAssign?: (id: string) => void; onUnassign?: (id: string) => void };

export function assignHandlers(
  _me: string | null,
  _period: string | null,
  _save: (id: string, owner: string) => Promise<void>,
): AssignHandlers {
  throw new Error('not built');
}
