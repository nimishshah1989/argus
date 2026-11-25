# HANDOFF

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-25 · **By:** Side session b73c706f (last-screens, started by local_8ef44b35) · **Model:** Sonnet 5.5
**Milestone:** M2 last old-design screens · **Branch:** plan/s26-a (context budget)

## State

- Merged on main (earlier): #760 kit (PR #776), #761 sign-in (#775), #777 heading fix (#778). Nothing merged this session.
- #762 S25 Guide, PR #779: CI was RED on e2e (browser 1/3/4) for two real causes, both FIXED in commit 75f20d39 on branch `t762-s25-guide-on-the-v2-kit-group-` (View.tsx only): (1) h1 now `t('analytics.guide.title')` = "Guide" (was 'The rule behind every figure'); (2) rail always gets a Desk link via `withDesk` (v1 showed Desk even for role `op`; e2e analytics-shell.spec.ts:110 expects `['Guide','Desk']`). Prettier OK. Ticket reopened, attempts reset (0/3). `loop finish 762` was started in background (log: scratchpad f762.log, outcome UNKNOWN): run `gh pr checks 779`. Possibly unrelated flakes seen in CI: who-is-acting.spec.ts:219, detail-downtime.spec.ts:7, desk lifecycle 409 "Already reported". If only those are red, tell the coordinator (local_8ef44b35) the exact check names. Then reviewer, merge.
- #763 S23 Monthly, PR #782: RED. loop-guard: raw-size regex hits two doc comments (`apps/web/src/screens/v2/monthly-report/adapter.ts`, `monthly-report.test.ts`: the "(#763)" style comment line trips the "raw colour/size" check, rewrite those header comments without `#763`/numbers+units). e2e RED (chromium): analytics-guide.spec.ts:10, analytics-reports.spec.ts:101, analytics-shell.spec.ts:19 and :110, analytics.spec.ts:235 (also phone: v2-shell.spec.ts:95). Guide ones are the #762 fixes (not in #782's base). analytics-reports.spec.ts:101 and analytics-shell.spec.ts:19 are probably the Reports page itself: read `s782.log` in scratchpad / re-run `gh run view --job 139339048591 --log-failed`. Attempts used 3/3 + rescue: next step is `loop prep 763 --fresh` after #762 merges (main moved), re-apply, one builder; read the e2e errors first.
- #765 S24 Annual: prep done earlier, NOT built. Start after #763 merges, load < ~10.
- S26-1..8: NOT planned. `plan/s26-a` has ADR 0046 only. ONE `loop plan "Plan the Settings sub-pages S26-1..S26-8 on the shared CRUD kit from #776 and ADR 0036, tickets plus light seeds (ADR 0034), following how #760 and the sign-in/guide tickets were done; no new decisions"` (Bash timeout 600000; on timeout check `gh pr list`).
- Coordinator was NOT messaged yet: PR #779 and #782 are open, nothing merged.

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
