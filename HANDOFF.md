# HANDOFF

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-24 · **By:** Plan · **Model:** Opus 5.5
**Milestone:** M2b screens lane + M3 history lane · **Branch:** plan/handoff-0034 · **PR:** #652 merged (b1f158bf)

## State

- S22 Money Matters (#644) split by Plan: `plan/s22-model` puts the model types, register, gallery view, its own catalogue `analytics-v2-money` and the coverage table on main; adapter and View are skeletons the tickets fill.
- Nimish's rule (loop PR 6): seeds carry critical tests only. Recorded in ADR 0034, applied to seeds t640, t641, t643 (pushed).
- Kept / removed: t640 7 / 3, t641 3 / 0, t643 5 / 2 (counts include the insight-coverage entry). Kept tests assert figures, not sentences or tone.
- Proof: on each seed, `pnpm exec vitest run <seed test> apps/web/src/screens/v2/insight-coverage.test.ts` is red only on missing takeaways/yardsticks (t640 6 red, t641 3, t643 5); `pnpm exec tsc --noEmit` 0 errors after merging main into each seed.
- Not applied: t642 (building), t644 (no seed branch; seeding blocked by #619/#620). t644's seed must follow ADR 0034.
- Carried from the 17:25 handoff, **not rechecked**: #651 waits on Nimish's yes; #649 (#642) needs `loop build 642` rerun; #650 and #634 red.

## Next step

Coordinator: `loop build 640`, `641`, `643` from the updated seeds (they now include main).

## Blocked / open questions

- Nimish: yes/no on #651 (ADR 0032 §1).
- Nimish: answer key's shift 3 (3.00 h) and 21.0 h/day vs the 2-shift, 16 h decision.

## Don't repeat

- The main checkout is shared with other sessions: one switched it to plan/screens-batch2 mid-session and my commit landed there (reverted on that branch). Do commits in a temp worktree; check the branch before every commit.

- ADR numbers: check every `origin/plan/*` branch before picking one (0033 was taken on plan/t642).
- Seeds 7 commits behind main did not typecheck (`KpiData.yardstick`); merge main before proving red.

## Files touched this session

- `docs/adr/0034-critical-tests-only.md` — the rule and the per-seed counts.
- Seeds: `dashboard/insight.test.ts`, `breakdown-log/takeaway.test.ts`, `machine/insight.test.ts`, `machine/model.ts` (`takeaways?`).
