# HANDOFF

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-25 · **By:** Coordinator (last-screens session 3) · **Model:** Sonnet 5.5
**Milestone:** M2 last old-design screens · **Branch:** plan/v2-last-screens (context budget)

## State

- Merged on main: #760 S26-0 kit (PR #776), #761 S19 sign-in (PR #775), #777 sign-in heading fix (PR #778; the wrong-password e2e failed because the v2 page had no "Sign in" heading).
- #762 S25 Guide: PR #779 open, CI green, NOT reviewed or merged yet: run reviewer subagent, merge on PASS, `loop clean 762`.
- #763 S23 Monthly: builder ran out of context with Bash denied; `loop finish 763` ran and failed 2 tests in `monthly-report.test.ts`: `monthlyReportModel(reply, realT)` returns null (attempt 1 of 3 used). Next: `loop prep 763`, `loop build 763 --bg` (notes are in the brief), then prettier on `docs/loop/handoff/763.md` via a builder-small subagent, `loop finish 763`.
- #765 S24 Annual: not prepped (after #763).
- S26-1..8: planning started on branch `plan/s26-a` (ADR 0046 written there, issues not yet created). Next: fresh `loop plan "S26-1 then S26-2 per ADR 0046 on plan/s26-a"`, 2 to 3 tickets per job.
- Action Center spec "opens at its v1 address" failure is NOT sign-in related: it waits for text "Nothing needs attention with the current limits." (other PR's change / stale gallery).

## Don't repeat

- Builders cannot run prettier: after `loop build`, have a `loop:builder-small` subagent run `pnpm exec prettier --write docs/loop/handoff/<N>.md` and commit, before `loop finish`.
- Builders can lose Bash mid-run ("don't ask mode"); check `loop wait` text for BLOCKED.
