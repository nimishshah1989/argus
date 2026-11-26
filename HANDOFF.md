# HANDOFF

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

<<<<<<< Updated upstream
**Updated:** 2026-11-26 ~17:00 IST · **By:** session `c39914a2…` · **Goal (Nimish, ADR 0055):** all screens live on the newest kit, nothing old remains · **Mode (ADR 0057):** one organic session, no loop rounds · **Branch:** plan/old-ui-guard

## State

- "What's left" is now measured: `tools/old-ui-left.test.ts` pins the old-design components the shipped app still renders (62 on 26 Nov). Done = the list is empty. Run it before answering Nimish.
- Who pulls them: Desk (`screens/v2/desk`), Ticket (`screens/v2/ticket`) and browser Board need the S28–S30 Shell redraw (PR #847, ADR 0056); Nimish must approve S28-desk, S29-ticket, S30-board. Floor internals (AccountSheet, Drafts, ui/button/input/sheet/tab-bar/text/floor-pieces, patterns/frame, wizard-page). Settings (screens/settings/{Plant,Jobs,Company,Translations}). Sign-in/who/password (`faces/signin/parts.tsx` Notice). Kit itself (`ui/v2/crud-page`, `form-sheet` use `patterns/form-sheet`, `crud-actions`). App.tsx (UpdateBanner, ui/layout, Analytics.tsx and TicketRoute shims).
- Open fix tickets: #842 (audit trail fixes; builder running), #846 (lists/profile "not set" bug). #819 is superseded by the guard.

## Next steps

1. Merge this guard. 2. Kit, Settings, sign-in, App wiring, Floor internals. 3. Desk/Ticket/Board once S28–S30 are approved. 4. Delete the old files and the dead gallery pages; the list reaches zero.

## Blocked

- All frontend work: S28-desk, S29-ticket, S30-board were redrawn (#847 merged, 929dca8e), which voids approvals; the hook blocks apps/web until Nimish runs `loop approve` for each. Asked him 26 Nov ~17:10.
=======
**Updated:** 2026-11-26 ~18:00 IST · **By:** session `c39914a2…` · **Goal (Nimish, ADR 0055):** all screens live on the newest kit, nothing old remains · **Mode (ADR 0057):** one organic session, parallel agents, no loop rounds · **Branch:** plan/handoff-s29

## State

- "What's left" is measured by `tools/old-ui-left.test.ts` (PR #849): old-design components the shipped app still renders, 62 on 26 Nov. Done = empty.
- Nimish approved S28-desk, S29-ticket, S30-board (PR #850).
- Four agents building in worktrees, one PR each: A `v2/kit-settings-signin` (kit leftovers, Settings Company/Translations = #794, sign-in Notice, App wiring, #846 lists fixes); B `v2/floor-on-kit`; C `v2/desk-ticket-shell` (Desk + Ticket into the v2 Shell); D `v2/board-shell`.
- #842 (audit trail fixes) builder was running via `loop build 842`; finish with `loop finish 842`.

## Next steps

1. Merge each agent PR when green; resolve OLD_LEFT conflicts in the guard test. 3. Delete old files no longer reached, plus their gallery pages; the list hits zero.

## Blocked

None.
>>>>>>> Stashed changes

## Don't repeat (details in LESSONS.md)

- Never answer "how much is left" from tickets or memory: run the guard.
<<<<<<< Updated upstream
- Nimish merges green PRs before review; run checks before pushing.
- Never `#NNN` in apps/web comments (hex guard). New API route → `REPLY_SCHEMAS` + route count in `reply-contract.test.ts`.
=======
- The loop hook blocks frontend only when no wireframe is approved at all, not when one is stale.
- Never put the approve command text inside a Bash command; the guard blocks it.
- Never `#NNN` in apps/web comments (hex guard).
>>>>>>> Stashed changes
