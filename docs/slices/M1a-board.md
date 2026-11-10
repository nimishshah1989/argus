# M1a-board — Live board and kiosk (SPEC 1.7)

## Goal

`/desk/board?kiosk=1` — a read-only **live board** of the plant for a wall TV or tablet at the
desk, refreshing itself from `/state`. No navigation in kiosk mode; large type; status colours
that never carry meaning alone.

## Behaviour

- Tiles grouped by **segment** and **group** (from `/config`), one per machine, showing the
  machine code and its current ticket status (open / in progress / waiting / cancelled-24h) or
  "idle" when nothing is open.
- A counts strip (total open, stopped, waiting, support, work requests) and filter chips by
  segment; a work-request footer.
- Data: `getConfig()` (machines, segments, groups) + `getState()` (open tickets with
  `machineId`, `machineSnapshot`, `status`, `problem`), joined client-side. TanStack Query with
  a 30s refetch; no actions.
- Kiosk mode hides the nav and backs off; a normal (non-kiosk) board keeps the app nav.

## Files and write scope

- `apps/web/src/screens/Board.tsx` (new) + `apps/web/src/screens/board/*` (Tile, BoardHeader) if
  needed to keep files ≤300 / functions ≤60.
- `apps/web/src/App.tsx` — add the `/desk/board` route.
- `apps/web/e2e/board.spec.ts` (new) — E2E: the board counts match `/state`; kiosk mode has no nav.

Disjoint from AC3a (which touched api.ts/TicketDetail.tsx/server); no server changes.

## Test cases

1. E2E: open `/desk/board?kiosk=1`; the counts strip and tiles match the open tickets; no nav links.
2. E2E: a machine with an open ticket shows its status; a machine with none shows idle.
3. `pnpm verify` and `pnpm test:e2e` green.

## Out of scope

PWA manifests + service worker (AC5), analytics, push, any write action.
