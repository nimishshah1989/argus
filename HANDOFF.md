# HANDOFF

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-25 · **By:** Coordinator (Sonnet 5.5) · **Model:** Sonnet 5.5
**Milestone:** M2 last old-design screens · **Branch:** plan/s26-a (context budget)

## State

- Merged on main: #760 kit (#776), #761 sign-in (#775), #777 heading fix (#778), plan PR #780 (sweep A–D coverage rows), #762 S25 Guide (PR #779, merged with the two e2e fixes: "Guide" h1 + always-present Desk link; main's deploy run for it is green). `loop clean 762` done.
- #762: nothing left. (Old note about Guide e2e red is resolved.) Possibly unrelated flakes seen in CI: who-is-acting.spec.ts:219, detail-downtime.spec.ts:7, desk lifecycle 409 "Already reported".
- #750 SWEEP-A, PR #781: open, RED (loop-guard + browser 4/5, 5/5); cause unread, run `loop ci 781`. #751/#752/#753 sweep B–D not started (coverage rows are on main).
- #763 S23 Monthly, PR #782: RED. loop-guard: raw-size regex hits two doc comments (`apps/web/src/screens/v2/monthly-report/adapter.ts`, `monthly-report.test.ts`: the "(#763)" style comment line trips the "raw colour/size" check, rewrite those header comments without `#763`/numbers+units). e2e RED (chromium): analytics-guide.spec.ts:10, analytics-reports.spec.ts:101, analytics-shell.spec.ts:19 and :110, analytics.spec.ts:235 (also phone: v2-shell.spec.ts:95). Guide ones are the #762 fixes (not in #782's base). analytics-reports.spec.ts:101 and analytics-shell.spec.ts:19 are probably the Reports page itself: read `s782.log` in scratchpad / re-run `gh run view --job 139339048591 --log-failed`. Attempts used 3/3 + rescue: next step is `loop prep 763 --fresh` after #762 merges (main moved), re-apply, one builder; read the e2e errors first.
- #765 S24 Annual: prep done earlier, NOT built. Start after #763 merges, load < ~10.
- S26-1..8: NOT planned. `plan/s26-a` has ADR 0046 only. ONE `loop plan "Plan the Settings sub-pages S26-1..S26-8 on the shared CRUD kit from #776 and ADR 0036, tickets plus light seeds (ADR 0034), following how #760 and the sign-in/guide tickets were done; no new decisions"` (Bash timeout 600000; on timeout check `gh pr list`).
- Coordinator (local_8ef44b35) is up to date as of this handoff.

## Don't repeat

- NEVER run `loop finish N` twice without a code change (burns an attempt). `loop prep N` on a finished ticket needs `gh issue reopen N` first (finish closes it).
- `loop finish` removes `.loop/wt/N` after pushing: `loop prep N` recreates it on the PR branch.
- Hooks block `git -C .loop/wt/N` for the coordinator, and holdout test paths for builders.
- v2 page title must be the screen's own name (`analytics.<x>.title`), e2e looks for heading by name; do not reuse the "heading" subtitle keys.
- Ticket "Files to change": one path per line, `- path — text`. New v2 report/page needs `PAGE_KEYS` entry in figure-content.ts.
- Every v2 screen PR touches live.tsx/Analytics.tsx: merge PRs one at a time. Builders cannot run prettier: use a builder-small subagent. zsh: write `${T}:path`.
- A comment line like "`(#763)` ... " inside source can trip the raw-size guard: avoid `#<n>`+unit-looking text in code comments.

## Blocked

None.
