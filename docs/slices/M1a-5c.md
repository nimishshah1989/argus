# M1a-5c — Ticket lists (Mine, Team, My complaints)

## Goal

Add a cursor-paginated, filterable `GET /api/v1/tickets` list (deferred from M1a-4), then wire
the desk **Mine/Team** tabs and the floor **My complaints** list. The Open board stays on
`/state`; only the personal/historical lists need this endpoint.

## Server contract (schemas in `packages/shared`)

`GET /api/v1/tickets?status=&kind=&machineId=&personId=&raisedBy=&from=&to=&cursor=&limit=`

- `status`, `kind` — comma-separated subsets of the allowed values.
- `personId` — tickets where the person is lead (`lead_person_id`) or an active crew member.
- `raisedBy` — tickets where `reported_by_person_id = raisedBy`.
- `from`/`to` — `reported_at` range (ISO date-time).
- `limit` default 50, max 200; `cursor` opaque.
- Response `{ items: Ticket[], nextCursor: string | null }`, ordered `updated_at DESC, id DESC`;
  cursor encodes `updated_at|id`. Tenant from auth (explicit `tenant_id` filter); cross-tenant
  is invisible.

## Files and write scopes (disjoint)

- **api worker** — `apps/server/src/ticket-list.ts` (new: handler + SQL; `tickets.ts` is near its
  400-line budget), `packages/shared/src/ticket.ts` (list-query schema), and
  `apps/server/test/tickets-list.test.ts` (new integration test).
- **web worker** — `apps/web/src/screens/Desk.tsx` (Open / Mine / Team tabs),
  `apps/web/src/screens/Floor.tsx` (a "My complaints" section), and `apps/web/src/api.ts`
  (add `listTickets(query)`).

## Web behaviour

- **Desk**: tabs `Open` (existing `/state`), `Mine` (`personId=<me.actingPersonId>`, statuses
  `open,working,waiting`), `Team` (active, same data as Open). Mine uses the list endpoint.
- **Floor**: a "My complaints" section listing `raisedBy=<me.actingPersonId>` (all statuses,
  newest first), read-only rows (ref, problem, status, when).
- Reuse the existing `TicketCard` / tokens; no new dependency.

## Test cases

1. List returns only the tenant's tickets; empty for another tenant.
2. `limit` caps results and `cursor` walks to the end without duplicates or gaps.
3. Filters: `status`, `kind`, `personId` (lead and crew), `raisedBy`, `from`/`to`.
4. Unauthenticated list → 401.

## Out of scope

Admin correct/restore actions from a list, machine-filter UI, infinite scroll, the board lists
(they stay on `/state`), and the Playwright E2E harness (separate follow-up).
