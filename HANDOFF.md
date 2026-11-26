# HANDOFF

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-26 ~17:45 IST · **By:** Plan · **Model:** Opus 5.5
**Milestone:** ADR 0055 (all screens live on the newest kit) · **Branch:** plan/s28-s30-shell-wireframes · **PR:** https://github.com/nimishshah1989/argus/pull/847 (CI green, not merged: the merge command was denied by the permission classifier)

## State

- Tests: no code changed. `loop ci 847` GREEN (6 pass, 5 skipped). Three wireframes render in Chromium at 1440 px, no sideways scroll; phone width and dark mode not checked.
- Last thing done: S28-desk, S29-ticket, S30-board redrawn in the v2 Shell (ADR 0055 point 2; assumptions in ADR 0056). Each has a Coverage table with every item of the 25 Nov approved wireframe and of #803. S30 TV frames copied unchanged. Their approvals are now void, on purpose.
- Still open from before: #815 (ready: `loop prep 815`), #794, then #819; Nimish's written yes on S18 rupees (ADR 0051 A5); planner follow-ups on #826 coverage, OEM null figure, 29 Feb warranty date.

## Next step

Coordinator merges #847. Then Nimish approves S28-desk, S29-ticket, S30-board himself; then `loop plan` the build tickets (Shell move + #803 items). Floor segment tiles (ADR 0055 point 1) still to plan.

## Blocked / open questions

- Nimish: phones lose the v1 bottom tab bar (tabs move to the top, Report becomes a button); ticket opens in a side panel on wide screens. Questions are in each wireframe.

## Don't repeat

- Never put the approve command text inside a Bash command (even in a heredoc or commit text): the guard blocks it. Write such files with the Write/Edit tools.
- Builders: plain literal commands only; never `#NNN` in apps/web comments; `loop finish` GREEN with checks pending → confirm with `gh pr checks` (details in LESSONS.md).

## Files touched this session

- design/wireframes/S28-desk.html, S29-ticket.html, S30-board.html — redrawn in the v2 Shell
- docs/adr/0056-desk-ticket-board-in-shell-wireframes.md — layout assumptions
