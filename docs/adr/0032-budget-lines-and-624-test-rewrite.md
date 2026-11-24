# 0032 — Budget line count includes main's merged-in lines (fixed in PR #651, needs Nimish's yes to merge); #624's export test is a rule rewrite, not a weakening

Date: 2026-11-24 · Decided by: Plan (unattended, ADR 0012)

## 1. Budget lines should count only the PR's own work — fix in PR #651, needs Nimish's yes

PRs #633 (#623), #637 (#625) and #634 (#624) failed loop-guard as over budget (461, 481 and 494 lines). The builds were not big. The #638 fix made the guard count only the PR's own **files** after a build branch merges main, but the **line** count still added up every line in `Plan-base...HEAD`, including main's merged-in work (`.loop.json` +203, `insight.ts` +146, HANDOFF, ADRs).

Real sizes, tests excluded as before: #623 is 4 files / 36 lines (budget 6 / 90), and #625 is 2 files / 56 lines (budget 4 / 120).

**Fix (PR #651, after review):** the budget now diffs the build against "the plan seed on top of the main the branch merged in" (`git merge-tree --write-tree <merge-base(main, HEAD)> <Plan-base>`), with `--numstat -M`. So:

- main's lines never count, even in a file both main and the build changed;
- the seed's lines never count, even in a file the builder also edited;
- a renamed file counts once, under its new path, with only its changed lines.

Files and lines both come from that one diff. Checked: `tools/check-pr-budget.test.ts` builds a repo with main merged in, a rename and a file changed by main, seed and builder; the old guard said 3 files / 142 lines, the new one says the true 2 / 4. On the real branches the new guard gives #633 4 / 36, #637 2 / 56, #634 4 / 69, all inside budget.

**Shortcut:** if the seed conflicts with main (merge-tree fails) or git is older than 2.38, the guard falls back to `Plan-base...HEAD` limited to the PR's own paths. In that case main's lines in a file the PR also changed still count. Upgrade if that ever fails a real build.

Still **needs Nimish's yes** before merge: a guard change, same as #638. Raising the Budget lines or splitting the tickets would not have helped, because the extra lines came from main, not from the tickets.

## 2. #624 rewrites two legacy-export tests because ADR 0026 changed the rule

ADR 0026 §1 makes Cosmos two shifts. #624 stops folding stray shifts (3ND to 2, anything else to 1) and holds them for the review tray instead. The plan seed (5e9f3b4f) rewrote two tests in `apps/server/src/seed/legacy-export.test.ts` to match:

- One test title changed. Its assertions are the same.
- `strayShift toBe(2)` became a stricter test: a held 3ND or 7TH row writes no ticket, `heldShift` counts 2, and identity still holds.

The number of tests did not drop. `quality:pr` reads a changed `it(` title and a replaced `expect(` as removals. The allowed fix is a `Tests removed: <reason>` line in the PR body that points to this ADR, plus the matching Q2 wording. The test file itself is not changed.

## Consequences

- After Nimish's yes and the fix merges, #633, #637 and #634 go green on loop-guard once their branch includes it. Merge main into each branch, because re-running the old run reuses the old merge commit. Until then they stay red.
- #634 is stacked on #623's build and carries two changelog fragments. `changelog:check` passes after #633 merges and #634 merges main.
- The same bug is in the loop plugin's `check_pr.py` template. Fix it upstream too, or the next `/loop:init` re-run will bring it back.
