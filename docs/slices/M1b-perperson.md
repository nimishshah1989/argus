# M1b-perperson — exact per-person minutes in the list projection

## Goal

The desk Team "monthly totals per person" uses `figures.perPerson`, which the `/tickets` list
projection leaves empty (detail-only). Populate it, so the **primary/support split is exact** and
the documented lead-`activeMin` fallback disappears.

## Approach

- `listTickets` (the list query) gains one grouped query over `work_segment` for the returned
  ticket ids: `SELECT ticket_id, person_id, role, started_at, ended_at FROM work_segment WHERE
tenant_id = $1 AND ticket_id = ANY($2)`.
- Compute each person's minutes per ticket **clipped to the ticket window** with the same rule as
  `figures()`'s `perPerson` (read `packages/domain/src/figures.ts` `perPerson` and mirror it; a
  pure helper shared with the domain if clean).
- Set `figures.perPerson` on the list projection (same shape as the detail).
- No web change needed: `monthlyTotals` already prefers `perPerson` and falls back only when it is
  empty.

## Files and write scope (one worker)

- `apps/server/src/ticket-list.ts` (+ a helper), `apps/server/src/ticket-mapper.ts`
  (`figuresFromRow` stays; add a `withPerPerson`/merge), `apps/server/test/tickets-list.test.ts`
  (new tests: a two-person ticket shows both in `perPerson` with their minutes; the split by role
  is lead/primary vs support).
- A pure helper in `apps/server/src/` or `packages/domain` if the clipping logic is shared.
- Keep `apps/server/src/tickets.ts` unchanged if possible.

## Test cases

1. A ticket worked by Asha (lead) + Bina (support) → list `figures.perPerson` has both with the
   right minutes, matching the detail's `figures.perPerson`.
2. A ticket with no segments → `{}`.
3. The list query still works for many tickets (no N+1 behaviour: one grouped query).
4. `pnpm verify` + `pnpm test:e2e` green.

## Out of scope

`/state` perPerson (the Team "Working now" uses the lead's `activeMin`), the team-variant day report.
