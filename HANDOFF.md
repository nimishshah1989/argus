# HANDOFF

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-26 · **By:** Plan (Opus 5.5) · **Model:** Opus 5.5

## State

- Main went red after #781 (sweep A) merged with failing browser shards. Fix PR from `plan/e2e-show-detail-folds`: spec-only (ADR 0048). Markup kept per ADR 0041; specs now open nested folds with `apps/web/e2e/show-detail.ts`, accept the R10 all-zero line, and run axe after CSS transitions. Proof: the 3 dashboard specs 64/64 green locally (2 runs × repeat-each 2), gallery dashboard spec 5/5.
- Flakes on #781 unrelated to it: who-is-acting.spec.ts:60 (ERR_ABORTED), desk-lists.spec.ts:11 phone (409 Already reported). detail-downtime.spec.ts:7 passed on #781.
- Unchanged from last handoff: open PRs #782 Monthly, #783 sweep B, #796 S26-1; builds #767/#769 in other sessions; S26 tickets from ADR 0047; not started #765, #752, #753.
- #783 (sweep B) adds 3 more copies of the bad `.all()` fold loop: `e2e/analytics-breakdowns.spec.ts`, `e2e/gallery/analytics-breakdown-pages.spec.ts`, `e2e/gallery/v2-bd-pm.spec.ts`. Switch them to `openShowDetail` on its seed before it merges. Not verified: the full e2e suite locally (CI runs it on the PR).

## Next step

1. Merge the fix PR when green; then `gh pr update-branch` #782, #783, #796 and re-read `loop ci` for each before merging (LESSONS 2026-11-26).
2. Then the previous plan: `loop finish 767`/`769`, S26-1, #765, #752, #753.

## Blocked / open questions

- Nimish: the Dashboard nests "Show detail" inside "Show detail" (ADR 0041 as written). Keep, or one fold per group? (ADR 0048 "Not done".)
- `design/approved.json` still has uncommitted S27–S30 approvals in the main checkout; commit on a plan branch.

## Don't repeat

- `loop build N` reads the issue BODY, not comments: put fix notes in the body (`gh issue edit`) before `loop prep`. `loop finish` commits leftover builder work itself.
- NEVER run `loop finish N` twice without a code change. `loop prep N` on a finished ticket needs `gh issue reopen N` first. `loop finish` removes `.loop/wt/N`.
- Re-running `/loop:init` overwrites `.github/loop/check_pr.py` with the stock file (drops ADR 0035/0038/0040 carve-outs) and writes machine paths into `.claude/settings.json`: `git checkout` both. Branch protection on main was NOT enabled.
- Hooks block `git -C .loop/wt/N` for the coordinator and holdout paths for builders. New v2 page needs a `PAGE_KEYS` entry in figure-content.ts; v2 page title is the screen's own name. Builders cannot run prettier: use builder-small.

## Files touched this session

`apps/web/e2e/{show-detail.ts, analytics.spec.ts, analytics-dashboard.spec.ts, v2-dashboard-live.spec.ts, gallery/v2-dashboard-live.spec.ts}`, `docs/adr/0048-dashboard-e2e-after-sweep-a.md`, LESSONS.md, HANDOFF.md.
