# HANDOFF

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-26 ~20:30 IST · **By:** session `c39914a2…` · **Goal (Nimish, ADR 0055):** all screens live on the newest kit, nothing old remains · **Mode (ADR 0057):** organic session, parallel agents · **Branch:** plan/handoff-s30

## State

- **ADR 0055 met by measurement:** `tools/old-ui-left.test.ts` on main f980d307 has `OLD_LEFT = []`. The shipped app renders no old-design component (62 on 26 Nov afternoon → 0).
- Merged this push: #849 guard, #850 S28–S30 approvals, #852 audit fixes (#842), #853 + #856 Board in Shell, #854 Floor on kit, #855 Settings Company/Translations (#794), sign-in, App wiring, lists/profile fix (#846), #857 Desk + Ticket in Shell.
- Nimish approved merging PRs whose only red check is loop-guard "existing test modified on a build branch" (26 Nov). Protected files stay plan-only.
- Branch v2/desk-data (Refs #803): the four S28/S29 items the server lacked are built server + UI: sign-off outcomes of the last 24 h on `/board/signoff`, `GET /state/crew` (crew roles, paused jobs under Working now), `machineAverage` on the ticket detail (engine MTTR in minutes, "no earlier breakdown" when none), `GET /tickets/recent-codes` + searchable code pickers (ui/v2/code-picker.tsx). No migration.

## Not built (server lacks data, or protected file)

- TV icon on "Open TV view" (needs a plan/ change to ui/v2/icons.tsx). Board rows open the machine panel, not the ticket. Day-score items out per ADR 0050.
- Dead old files only the dev gallery imports (ui/close-kit, counts-strip, detail-kit, tick-row, ticket-card, top-bar, side-nav, patterns/crud-list, crud-page, queue-table, ui/filter-chip, shims screens/analytics/Analytics.tsx, patterns/crud-actions.ts, form-sheet.tsx) can be deleted with their gallery pages in a plan/ PR.

## Next steps

1. Nimish clicks through Desk, Ticket, Board, Floor and Settings on staging. 2. Plan the "not built" items above. 3. Floor segment tiles (ADR 0055 point 1).

## Don't repeat

- Never answer "how much is left" from tickets or memory: run the guard.
- Never tell agents a protected file is editable; CI loop-guard rejects it off plan/ branches.
- Never put the approve command text in a Bash command.
