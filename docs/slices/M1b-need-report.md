# M1b-need-report — Needs-report list (SPEC 1.6)

## Goal

A technician who closes a breakdown **without a report** leaves the report due for seven days:
the ticket appears on their **needs-report list** and the report can be filed late.

## Contract

- `GET /api/v1/state` gains `needReport: Ticket[]` — tickets that are `closed`, whose
  `closeKind` is `no_report` (or which have no breakdown report stored), and whose `closedAt` is
  within the last 7 days. Ordered by `closedAt` descending. Scoped to the acting person: the
  person who closed it (`closed by` / lead) or the tickets on their crew; an admin sees the
  tenant's list. (Reuse the existing projection; no new columns if the close event/`edit` data
  already carries it.)
- Filing the late report is the existing breakdown report flow (`POST /tickets/{id}/report` or
  the file upload) — once a report exists, the ticket drops off the list.
- The desk shows the list (a "Needs report" segment) and opens the ticket with a "File report"
  action.

## Files and write scope (two workers, disjoint)

- **server worker** — `apps/server/src/tickets.ts` (the `state` handler + a helper in
  `ticket-list.ts` if cleaner), `apps/server/test/state.test.ts` (new or extended): a
  closed-without-report ticket appears in `needReport`; a reported one does not; one older than
  7 days does not; another tenant's does not.
- **web worker** — a `components/NeedReportList.tsx` (or a desk segment), `screens/Desk.tsx`
  wire-in, `apps/web/src/api.ts` (the state type), `e2e/desk.spec.ts`: close without report →
  appears in Needs report → file the report → disappears.

## Test cases

1. Server: `needReport` includes a fresh `no_report` close and excludes reported / >7-day /
   other-tenant tickets.
2. E2E: the desk's Needs report list shows the ticket after a no-report close; filing the report
   removes it.
3. `pnpm verify` + `pnpm test:e2e` green.

## Out of scope

The day-report PDF (separate slice), Gujarati, the update banner.
