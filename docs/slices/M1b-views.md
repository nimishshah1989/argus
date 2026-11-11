# M1b-views — Desk Team + Mine views (SPEC §3 Views)

## Goal

Finish the desk "Views" parity rows: the **Team** tab's sections and **Mine**'s closed window,
plus the **day report** link.

## What the desk shows now

Team and Mine exist, but Team lacks the per-state sections and Mine lacks the closed window/day
report.

## Required (SPEC §3, PARITY §v3/Views)

- **Team** tab sections:
  - **Working now** — grouped by person (who is on what, their minutes).
  - **Waiting** — tickets waiting for material/subcontractor with the wait reason.
  - **Not started** — open, unassigned/unstarted.
  - **Cancelled, last 24 hours**.
  - **Closed, last 30 days**, with **monthly totals per person** (primary vs support minutes).
- **Mine** tab:
  - In progress for me (or everyone on a shared phone), waiting assigned to me,
  - **Closed, last 30 days** (mine),
  - a **Day report** button that downloads `GET /api/v1/reports/day.pdf?date=<today>` (the existing
    endpoint; a plain `<a href>`/fetch → blob download, no new server work).

## Data

- Live sections come from the existing `GET /state` (open/working/waiting + needReport).
- Closed/cancelled lists from `GET /tickets` (`listTickets`) with the status filter, filtered
  client-side to the 24-hour / 30-day windows; monthly totals computed from the 30-day closed list.

## Files and write scope (one worker — the desk is shared)

- `apps/web/src/screens/desk/Board.tsx` + a new `apps/web/src/screens/desk/TeamPanel.tsx`
  (or split further so files stay ≤300) and the Mine panel (`Board.tsx`/`screens/desk/*`).
- `apps/web/src/api.ts` / `api-types.ts` for any list-filter type additions.
- `apps/web/src/i18n/en.ts` (+ `gu.ts` derived).
- `apps/web/src/components/format.ts` helpers if a minutes/aggregation helper is cleaner there.
- `apps/web/src/screens/desk/views.test.ts` (new) for the aggregation (monthly totals per
  person, primary/support split, window filtering).
- `apps/web/e2e/desk.spec.ts` (extend) — the Team sections render; the Mine day report link is
  present (the download itself may be checked by the anchor's href, not a real download).

## Rules

- Client-side only; no server change.
- All copy via `t()` (i18n lint rule); mobile-first; files ≤300, functions ≤60.
- The existing desk/board/offline e2e must stay green.

## Out of scope

The team-variant day report (server), the Views beyond M1, Live-board changes.
