# HANDOFF

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-25 · **By:** coordinator (S27-S30 floor/desk/ticket/board) · **Model:** Sonnet 5.5
**Milestone:** M2 last old-design screens · **Branch:** plan/s27-s30-handoff (stopped at context budget)

## State

- Plan PR #766 merged (ADR 0045, scope files `docs/design/v2/scope/{floor,desk,ticket,board}.md`). Issues #767 S27-A, #768 S27-B, #769 S28-A, #770 S28-B, #771 S29, #772 S30; seeds `plan/t767`..`plan/t772` pushed. Build order T1..T6 (ADR 0045 Tickets); #772 is independent; #768 needs #767; #770 and #771 need #769.
- #767 and #769: `loop build --bg` builders wrote code but ended (Bash denied in dontAsk mode on #767; context full on #769), nothing verified. Two `loop:builder` subagents were started to finish them in `.loop/wt/767` and `.loop/wt/769` (ids aebaaaa8401b8a177 for 767, a21abcc686e53f6be for 769); their reports were pending. Next: read their results, `loop finish <N>`, `loop ci`, reviewer, merge.
- The orchestrator may not edit inside `.loop/wt/<N>` (hook); use the `loop:builder` subagent, not `loop build`, when Bash gets denied.
- Nothing else started: #768, #770, #771, #772.

## Blocked

- Approvals for S27-floor, S28-desk, S29-ticket, S30-board were uncommitted in the main checkout and have vanished (`loop status` shows "waiting for Nimish"). Nimish must re-run `loop approve` for each and get it committed to main before any S27-S30 PR can pass loop-guard.
- The coordinator session local_8ef44b35 is archived; PR/merge one-liners cannot be sent to it.

## Don't repeat

- Do not run `loop plan` on the shared main checkout: it may sit on another session's branch (the first run committed onto plan/t763, the S23 seed; PR #764 closed).
- Wireframe items that clash with locked control-order specs are listed under "Unbuilt from the wireframe" in each scope file: Nimish's written yes needed before those PRs merge.
