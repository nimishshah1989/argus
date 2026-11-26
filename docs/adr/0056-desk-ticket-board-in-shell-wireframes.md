# ADR 0056: How Desk, Ticket and the browser Board sit inside the v2 Shell (wireframe assumptions)

Date: 26 Nov 2026 · Decided by: Plan (unattended; ADR 0055 point 2). Each point is an assumption Nimish confirms or
changes when he approves S28-desk, S29-ticket and S30-board with `loop approve`.

## Context

ADR 0055 moves Desk (Open, Mine, Team), the ticket page and the browser Board into the v2 `Shell` (rail, header, kit
cards and tables, insight first). The TV/kiosk board and Floor keep their own frames. The redraw must keep every item of
the S28-S30 wireframes approved on 25 Nov and every item of issue #803 (shipped without them under ADR 0050).

## Decisions (assumptions)

1. **Rail:** Desk stays the rail's foot entry and is marked current on all three screens. No new rail section.
2. **Desk views are section tabs** (the kit `Segmented`, as Analytics sections have): Open (count), Mine, Team, Live
   board. The v1 bottom tab bar goes, on phones too. v1's Report tab becomes a "Report a problem" primary button beside
   the tabs (opens S27). Plant settings and Settings stay buttons there for admin and head.
3. **Lists are kit tables** (cards on a phone), worst first, each with a one-line takeaway and a marked outlier; counts
   are kit tiles with a yardstick (of N machines, target, average).
4. **Wide screen:** a ticket opened from a Desk list or the Board opens in the kit drawer beside the list (replaces v1
   two-pane); opened by link, it is a full Shell page with "← Open tickets".
5. **Ticket sheets** (pause, transfer, update, join, leave, cancel, close flow) are the kit form sheet: side panel when
   wide, bottom sheet on a phone. Fields and words unchanged.
6. **Board browser view** is the Desk's "Live board" tab at `/desk/board`; it shows every stop (no cap). The TV frames
   in S30 are carried over unchanged.
7. **#803 items are drawn, not dropped:** sign-off outcomes list, Acknowledge / Post update quick buttons, crew roles
   and paused jobs under Working now, monthly ticket counts per person, ticket takeaway (downtime vs average, response vs
   target), Download PDF, searchable code tap-lists, Pause held by lockout, day-score target line and verdict, response
   vs yesterday, "Today" heading.

## Consequences

- Approvals of S28, S29, S30 are void until Nimish re-approves; frontend work on these screens waits for that.
- After approval, the planner writes the build tickets (Shell move + #803 items); #803 closes when they merge.
