# HANDOFF

_Overwritten at the end of every session. Facts only._

**Updated:** 2026-11-25 · **By:** Coordinator (Sonnet), 7th session in the chain · ended on the context budget.

## State

- **Merged:** PR #740 (loop-guard accepts `Screens: none (kit only)` / `none` when every changed file is under `apps/web/src/ui/`, `changes/`, `docs/loop/handoff/`; ADR 0040, Plan wrote and merged it). After `gh pr update-branch` + green CI, #736 (#697), #737 (#691), #738 (#699) merged (merger.sh did it; each had an earlier reviewer PASS). I did NOT edit any PR body to name S01-dashboard (the last handoff said that needs Nimish's own yes).
- **Open, green:** PR #741 (#694 ranked bars). Reviewer subagent was started on it and had not reported; check `gh pr view 741` (merger.sh may merge it first). If still open: re-run the reviewer, then merge on PASS.
- **#692:** built (code 56a750ad). `loop finish 692` failed only on `prettier --check docs/loop/handoff/692.md`. I ran `loop prep 692` (attempts_so_far 1). Next: `loop build 692 --bg`, `loop wait 692`, `loop finish 692`. Tell the builder to run `pnpm exec prettier --write docs/loop/handoff/692.md` and leave `## Blocked` empty of text (the old Blocked text must be removed).
- **#685 (PR #739, reviewer FAIL):** Plan fixed the seed `plan/t685` (2.2/2 band-edge test, aria-label unit test; issue rules updated). Next: `loop prep 685 --fresh`, `loop build 685 --bg`, `loop finish 685`, review.
- **#700:** cause found: the guard reads `.loop.json` from the MAIN checkout, which was sitting on `plan/t701` (old `.loop.json` from before ADR 0039 locked `entity-chip.tsx`). Plan merged main into `plan/t700`. Next: `loop prep 700 --fresh`, build, finish.
- **#701 (PR #731):** `plan/t701` is fixed (363bf300; ADR renamed `0041-gujarati-switch-per-phone`). Its `Screens:` line cannot be `none`: it changes `apps/web/src/i18n/index.ts` and `AccountSheet.tsx`, outside ADR 0040's folders. Needs a real approved screen id in the PR body (the S01-dashboard workaround, which needs Nimish's yes) or Plan extending ADR 0040. Then `loop prep 701 --fresh`.
- Not touched yet: 704, 695, 696 (build one or two at a time, load under ~10; load was 2–4).

## Next step

1. `gh pr view 741`; merge #694 on reviewer PASS. 2. `loop clean 697 691 699 694` after merges. 3. Rebuild 692, 685, 700 (max two at once), then 704, 695, 696. 4. Ask Nimish one question: how #701's `Screens:` line should be handled. 5. Final 5-line report to Nimish (merged, what he can click on staging, what needs him, screens done — 52 v2 screen folders exist, NOT checked each is routed and live).

## Blocked (stop rule: no further attempt without Nimish's word)

- #687 (PR #726): ticket rule 1 vs hidden test `compare/holdout/tables-edges.test.ts`; Plan must change one. #643 (PR #707): merge `plan/t643-e2e` (a6521bc) into its build branch, delete the spares note line at `machine/View.tsx:149`, set PR body `Plan-base: a6521bc6b7e24790b6ff1dfdb5000bc542a26995`, `loop ci 707`. #701: see above.

## Follow-ups for Plan (not blocking)

- #686 TileSet: `Math.max(0, NaN)` folds every tile; "All 1 are zero" wording; `<details>` grid in older browsers. #691: raw px values, no `:focus-visible`, count not formatted, unique keys. #699: non-integer count; chips read run together. #698: amber watch tone never shows; `count <= 0` lets NaN through.

## Don't repeat

- KEEP THE MAIN CHECKOUT ON `main` while builders run: the guard reads `.loop.json` from it. Plan jobs leave it on a plan branch sometimes; check `git branch --show-current`.
- After any seed change, `loop prep N --fresh`. Plain `loop prep N` keeps the old seed (692 and 694 first builds were blocked this way). Plain prep is right only after a CI/review failure.
- Builders forget `pnpm exec prettier --write docs/loop/handoff/<N>.md`; a `## Blocked` section with any text makes `loop finish` refuse.
- merger.sh merges green PRs before the reviewer reports. The hook blocks commands that name a build folder path. Commit handoffs from a detached worktree and `git push origin HEAD:plan/handoff`. Start commands with `cd /Users/nimishshah/argus &&`. Never dump attempt notes; use `sed 's/\x1b\[[0-9;]*m//g'`.
