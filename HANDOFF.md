# HANDOFF

_Overwritten at the end of every session. Facts only._

**Updated:** 2026-11-25 (afternoon) · **By:** Coordinator (top session), context full · **Branch:** plan/handoff-coord

## State

- **Kit:** 18 of 22 pieces on staging. #749 (685 687 688 692 696 700 701 704) merged by Nimish. Left out: #689 (printed totals to footer), #695 (Pareto to ranked bars): both need a planner test change; #705 (entity drawers) and #732 (xlsx hardening): no seed.
- **Money Matters:** #644 (#745) and #678 (#748) merged. #679 go-live is PR #755, red only because `apps/web/e2e/analytics-compare.spec.ts:154` finds two regions named "Where the money was lost" (Plan fixes the selector).
- **Page batches A–D = tickets #750–#753:** builds finished in `.loop/wt/<N>` but BLOCKED on plan-owned `docs/design/v2/scope/<page>.md` coverage rows (#752's verdict table text is in `.loop/wt/752/docs/loop/handoff/752.md`; #751 also needs a `refused-login.test.ts` typecheck fix). The dashboard keeps its bubble chart (Nimish: "No, keep bubble").
- **A `loop plan` job is running** (started ~now, log `/private/tmp/claude-501/plan-batches.log`): coverage rows for 750–753, the #751 typecheck fix, the #755 selector. Check `gh pr list` for its plan PRs and merge them when green. Do not start another.
- #707 (#643 machine page) is closed under the stop rule; old code is on `keep/t643-prev`. The machine page returns later in its own batch.
- Detailed pages handoff: `origin/plan/handoff-sweep-706c` (49f2d48a).

## Next step

1. When the planner's PRs are merged: `loop prep <N> --fresh`, `loop build <N> --bg`, `loop wait <N>`, `loop finish <N>` for 750–753 (one rebuild each, two at a time, load under ~10). The rebuilt handoff's `## Blocked` section must read exactly "None." Reviewer, merge on PASS.
2. Merge #755 when its browser tests are green, then clean up.
3. Then #689, #695 (planner test change first), #705, #732 (need seeds), and old-design pages (Reports, Guide, Login, Settings). S27–S29 wait for Nimish's wireframe approval.
4. Report to Nimish in plain words: kit pieces done, pages live (none are in their final version yet; 24 are new-design, 7 old-design), PR links.

## Blocked

- Nothing needs Nimish right now. #707 stopped by the stop rule.

## Don't repeat

- Nimish is furious about re-planning: never re-propose pilots or combined tickets; ADR 0036 and 0041/0043 are the plan. Report in plain words, one line the moment a PR opens (he types `/ship <PR>` in that session; only he can).
- Builders (dontAsk mode) are denied heredocs, redirects, subshells, brace expansion, `$?`. Write/Edit plus one simple command per call. A handoff `## Blocked` text of any kind makes `loop finish` refuse.
- The HANDOFF.md stop hook fires falsely when other sessions move the shared checkout; ignore it while a handoff branch is current.
- merger.sh can merge green PRs before the reviewer finishes: review promptly.
