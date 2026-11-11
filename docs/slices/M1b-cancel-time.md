# M1b-cancel-time — exact cancelled timestamp

## Goal

Remove the "Cancelled last 24h" approximation in the desk Team view: cancelling a ticket records
**when** it happened, exactly, and the list projection carries it.

## Changes

- **Migration 0004**: `ALTER TABLE ticket ADD COLUMN cancelled_at timestamptz` (nullable,
  expand-only; existing rows stay NULL).
- **Domain**: `cancel` sets `cancelledAt: at` on the ticket (the transition time); the `Ticket`
  type gains `cancelledAt?`; `restore` clears it (back to its previous status).
- **Server**: `ticket-sql` persists/selects `cancelled_at`; the projection maps `cancelledAt`.
- **Web**: the desk `views.ts` "Cancelled last 24h" window uses `cancelledAt` (falling back to the
  old best-timestamp only for pre-migration rows).

## Files and write scope (two workers, disjoint)

- **server worker** — `packages/db/migrations/0004_*.sql`, `packages/domain/src/state/*`
  (cancel/restore + the Ticket type), `packages/domain/test/state.test.ts`,
  `apps/server/src/ticket-sql.ts`, `apps/server/src/ticket-mapper.ts`,
  `apps/server/test/tickets-commands.test.ts` / a state test.
- **web worker** — `apps/web/src/screens/desk/views.ts` (+ `views.test.ts`) to prefer
  `cancelledAt`, and `api-types.ts` if the Ticket type needs it.

## Tests

1. Domain: cancel sets `cancelledAt`; restore clears it.
2. Server: the cancel command persists `cancelled_at` and the list/detail projection returns it.
3. Web: the 24h window uses `cancelledAt` (and falls back for old rows).
4. `pnpm verify` + `pnpm test:e2e` green; `migrations:check` clean (M10 guard: the new file is new,
   not an edit — fine).

## Out of scope

`figures.perPerson` in the list projection (a heavier aggregate; the documented fallback stays).
