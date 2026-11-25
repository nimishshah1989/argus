# HANDOFF

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-25 · **By:** Coordinator (last-screens session) · **Model:** Sonnet 5.5
**Milestone:** M2b screens lane, S19/S23-S26 onto v2 · **Branch:** plan/handoff-last-screens-2 (context budget)

## State

- Plan branch `plan/v2-last-screens` pushed (ADR 0044, coverage tables for S19/S23/S24/S25, no PR opened yet: open it, merge when green).
- Tickets: #760 Settings kit CRUD (seed plan/t760), #761 S19 sign-in (plan/t761), #762 S25 Guide (plan/t762), #763 S23 Monthly (plan/t763), #765 S24 Annual (plan/t765, after #763; deletes ReportsPage).
- Build state: #760 built, `loop finish 760` and `loop finish 761` ran in background (task output in scratchpad; check `gh pr list`). #761 handoff prettier fixed (f9d02a64). #762 builder running in the background (`loop wait 762`). #763, #765 not prepped.
- Not planned yet: S26-1..8 (Settings sub-pages: ADR 0044 decision 4). One `loop plan` job needed: it must read ADR 0044 first and write issues + seeds one ticket at a time. Build after #760 merges.
- Plan branch `plan/t763` had Nimish's S27-S30 approvals + metrics committed by mistake; reverted in 0d45c0f6. Patch saved in the shared notes folder (`approvals-S27-S30.patch`). Nimish's main checkout may need `loop approve` for S27-S30 again.

## Next step

1. `gh pr list`; for #760/#761/#762: `loop ci <pr>`, reviewer subagent on green, merge on PASS (never with red browser checks; message coordinator `local_8ef44b35-772d-4933-ac27-9643e49a7356`, now archived: tell Nimish instead).
2. `loop prep 763` then build; then #765. Then plan and build S26-1..8.

## Blocked

None.

## Don't repeat

- Builders cannot run prettier: their handoff file fails `format:check`. After `loop build`, have a `loop:builder-small` subagent run `pnpm exec prettier --write docs/loop/handoff/<N>.md` and commit, before `loop finish`.
- The loop hook stops the coordinator editing `.loop/wt/<N>/` and anything naming `design/approved.json`.
- `loop plan` runs out of context after about 3 tickets: ask for 2 to 3 tickets per job.
- Machine load hit 25 with other sessions building; check `uptime` before starting builds.
