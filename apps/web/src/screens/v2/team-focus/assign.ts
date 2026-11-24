/** Ticket 594: "I'll take it" handlers; absent until the signed-in person and the month are both known. */
export type AssignHandlers = { onAssign?: (id: string) => void; onUnassign?: (id: string) => void };

export function assignHandlers(
  me: string | null,
  period: string | null,
  save: (id: string, owner: string) => Promise<void>,
): AssignHandlers {
  if (me === null || period === null) return {};
  return {
    onAssign: (id) => void save(id, me),
    onUnassign: (id) => void save(id, ''),
  };
}
