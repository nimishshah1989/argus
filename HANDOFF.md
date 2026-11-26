# HANDOFF

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-26 ~18:00 IST · **By:** session `c39914a2…` · **Goal (Nimish, ADR 0055):** all screens live on the newest kit, nothing old remains · **Mode (ADR 0057):** one organic session, parallel agents, no loop rounds · **Branch:** plan/handoff-s29

## State

- "What's left" is measured by `tools/old-ui-left.test.ts` (#849 merged): old-design components the shipped app still renders, 62 on 26 Nov. Done = empty.
- Nimish approved S28-desk, S29-ticket, S30-board (#850 merged).
- Floor is on the v2 kit (`v2/floor-on-kit`): new `ui/v2/{floor-kit,wizard,bottom-sheet,account-sheet,alerts-card,drafts-list,status-pill}.tsx` + `floor.css`; Desk can swap to `ui/v2/account-sheet` / `drafts-list` / `status-pill` to drop the old ones. OLD_LEFT minus wizard-page, floor-pieces, ui/text.
- Four agents building in worktrees, one PR each: A `v2/kit-settings-signin` (kit leftovers, Settings Company/Translations = #794, sign-in Notice, App wiring, #846 lists fixes); B `v2/floor-on-kit`; C `v2/desk-ticket-shell` (Desk + Ticket into the v2 Shell); D `v2/board-shell`.
- D `v2/board-shell`: /desk/board in the v2 Shell (rail on Desk, Desk tabs, Report a problem, Open TV view); the TV keeps its own frame; Board uses only v2 pieces (new `ui/v2/sync-status.tsx`); `ui/machine-icon.tsx` off OLD_LEFT.
- C `v2/desk-ticket-shell`: Desk (Open, Mine, Team) and /desk/:id in the v2 Shell (EntityShell); a ticket picked on a wide list opens in the kit drawer (history state `from`), by link or on a phone a full Shell page; actions, close flow, lockout, sign-off, tasks, PM, admin, PDF rebuilt under `screens/v2/ticket/{actions,close,parts}`; 29 OLD_LEFT lines off plus 4 freed by Floor/Board. Not built (need API data): sign-off outcomes list (#803), crew roles in Working now, per-machine downtime average in the ticket lede, searchable code tap-lists.
- #842 (audit trail fixes) builder was running via `loop build 842`; finish with `loop finish 842`. #819 is superseded by the guard.

## Next steps

1. Merge each agent PR when green; resolve OLD_LEFT conflicts in the guard test. 2. Delete old files no longer reached, plus their gallery pages; the list hits zero.

## Blocked

None.

## Don't repeat (details in LESSONS.md)

- Never answer "how much is left" from tickets or memory: run the guard.
- The loop hook blocks frontend only when no wireframe is approved at all, not when one is stale.
- Never put the approve command text inside a Bash command; the guard blocks it.
- Never `#NNN` in apps/web comments (hex guard). New API route → `REPLY_SCHEMAS` + route count in `reply-contract.test.ts`.
