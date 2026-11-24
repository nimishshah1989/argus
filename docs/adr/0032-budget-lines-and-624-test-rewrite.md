# 0032 — Budget line count includes main's merged-in lines (fix PROPOSED, needs Nimish); #624's export test is a rule rewrite, not a weakening

Date: 2026-11-24 · Decided by: Plan (unattended, ADR 0012)

## 1. Budget lines should count only the PR's own files — PROPOSED, needs Nimish's yes

PRs #633 (#623), #637 (#625) and #634 (#624) failed loop-guard as over budget (461, 481 and 494 lines). The builds were not big. The #638 fix made the guard count only the PR's own **files** after a build branch merges main, but the **line** count still added up every line in `Plan-base...HEAD`, including main's merged-in work (`.loop.json` +203, `insight.ts` +146, HANDOFF, ADRs).

Real sizes, tests excluded as before: #623 is 4 files / 36 lines (budget 6 / 90), and #625 is 2 files / 56 lines (budget 4 / 120). Proposed fix, one condition in `.github/loop/check_pr.py` (the budget line loop):

```diff
-            if a.isdigit() and d.isdigit() and not skip(p):
+            if a.isdigit() and d.isdigit() and not skip(p) and p in paths:  # main's merged-in files don't count
```

Ran the current guard and the patched guard on the three branches with their real PR bodies. Current: all three fail. Patched: all three pass. **Not applied.** A plan session may not change the CI guard on its own (permission denied, same as #638, which needed Nimish's yes). Raising the Budget lines or splitting the tickets would not help, because the extra lines come from main, not from the tickets.

## 2. #624 rewrites two legacy-export tests because ADR 0026 changed the rule

ADR 0026 §1 makes Cosmos two shifts. #624 stops folding stray shifts (3ND to 2, anything else to 1) and holds them for the review tray instead. The plan seed (5e9f3b4f) rewrote two tests in `apps/server/src/seed/legacy-export.test.ts` to match:

- One test title changed. Its assertions are the same.
- `strayShift toBe(2)` became a stricter test: a held 3ND or 7TH row writes no ticket, `heldShift` counts 2, and identity still holds.

The number of tests did not drop. `quality:pr` reads a changed `it(` title and a replaced `expect(` as removals. The allowed fix is a `Tests removed: <reason>` line in the PR body that points to this ADR, plus the matching Q2 wording. The test file itself is not changed.

## Consequences

- After Nimish's yes and the fix merges, #633, #637 and #634 go green on loop-guard once their branch includes it. Merge main into each branch, because re-running the old run reuses the old merge commit. Until then they stay red.
- #634 is stacked on #623's build and carries two changelog fragments. `changelog:check` passes after #633 merges and #634 merges main.
- The same bug is in the loop plugin's `check_pr.py` template. Fix it upstream too, or the next `/loop:init` re-run will bring it back.
