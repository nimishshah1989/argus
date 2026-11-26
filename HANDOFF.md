# HANDOFF

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-26 ~17:00 IST · **By:** session `c39914a2…` · **Goal (Nimish, ADR 0055):** all screens live on the newest kit, nothing old remains · **Mode (ADR 0057):** one organic session, no loop rounds · **Branch:** plan/old-ui-guard

## State

- Floor (`screens/v2/floor`) is on the v2 kit (branch `v2/floor-on-kit`): new kit pieces `ui/v2/{floor-kit,wizard,bottom-sheet,account-sheet,alerts-card,drafts-list,status-pill}.tsx` + `floor.css`; Desk can swap to `ui/v2/account-sheet` / `drafts-list` / `status-pill` to drop the old ones. OLD_LEFT minus wizard-page, floor-pieces, ui/text.
- "What's left" is now measured: `tools/old-ui-left.test.ts` pins the old-design components the shipped app still renders (62 on 26 Nov). Done = the list is empty. Run it before answering Nimish.
- Who pulls them: Desk (`screens/v2/desk`), Ticket (`screens/v2/ticket`) and browser Board need the S28–S30 Shell redraw (PR #847, ADR 0056); Nimish must approve S28-desk, S29-ticket, S30-board. Floor internals (AccountSheet, Drafts, ui/button/input/sheet/tab-bar/text/floor-pieces, patterns/frame, wizard-page). Settings (screens/settings/{Plant,Jobs,Company,Translations}). Sign-in/who/password (`faces/signin/parts.tsx` Notice). Kit itself (`ui/v2/crud-page`, `form-sheet` use `patterns/form-sheet`, `crud-actions`). App.tsx (UpdateBanner, ui/layout, Analytics.tsx and TicketRoute shims).
- Open fix tickets: #842 (audit trail fixes; builder running), #846 (lists/profile "not set" bug). #819 is superseded by the guard.

## Next steps

1. Merge this guard. 2. Kit, Settings, sign-in, App wiring, Floor internals. 3. Desk/Ticket/Board once S28–S30 are approved. 4. Delete the old files and the dead gallery pages; the list reaches zero.

## Blocked

- All frontend work: S28-desk, S29-ticket, S30-board were redrawn (#847 merged, 929dca8e), which voids approvals; the hook blocks apps/web until Nimish runs `loop approve` for each. Asked him 26 Nov ~17:10.

## Don't repeat (details in LESSONS.md)

- Never answer "how much is left" from tickets or memory: run the guard.
- Nimish merges green PRs before review; run checks before pushing.
- Never `#NNN` in apps/web comments (hex guard). New API route → `REPLY_SCHEMAS` + route count in `reply-contract.test.ts`.
