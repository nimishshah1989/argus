# HANDOFF

> **Read ADR 0012 first.** Nimish is away; the loop runs unattended. Plan decides §6 (ADR each) except answer-key changes, production, money, irreversible data steps. **ADR 0015:** M1 closes without G1.2a and Shift KPIs/Energy G1.4.

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-23 · **By:** Plan · **Model:** claude-opus-5-5
**Milestone:** M1 Stabilise (finishing) · **Branch:** plan/handoff-m1-ci

## State

- Merged: #556 (G1.5), #561 (G1.1), #564 (G1.6), #566 (ADR 0015 handoff).
- CI re-running, reviewer not yet run: **#563** (#552 G1.3), **#565** (#553 G1.2b), **#567** (#554 G1.4 Dashboard), **#569**
  (#555 G1.4 Problem Analysis, built this session). Seeds `plan/t552–554` synced with main and merged into their PR
  branches; `Plan-base` repointed; #567/#569 got full Argus bodies, `Screens: S01-dashboard` / `S12-problem-analysis`, and
  Prettier fixes on their handoff notes. Green → `reviewer` → merge → `loop clean <N>`; then tick M1 goals, mark M1 done.

## Next step

1. Finish the four PRs above. 2. M2 (`to-spec` → `loop-ticket`, new GitHub label: old `M2` label is on unrelated #105–#112).
   41 MISSING rows remain, all in `docs/design/v2/scope/batch1.md`: Data Checklist 17 (`:103-130`), Team Focus 4, Compare 20
   (`:197-228`). v2 folders exist for all three but run on fixtures, not live. Chunks: DC-1 live adapter + section counts +
   dates + drill; DC-2 the 11 dropped checks (engine has them); TF-1 all 4 rows (notes saved via plant config `focus:`);
   CMP-1 score/scorecard/category avg (ADR 0013); CMP-2 11 checkup rows; CMP-3 key tables + sort; CMP-4 money for heads only;
   then one go-live ticket per screen that deletes its v1 page (`DataChecklist.tsx`, `TeamFocusPage.tsx`+`TodayRest.tsx`,
   `MachinesPage/KeyPage/key-screen/key-body`). CMP-2 "Money lost" vs v1 spares cost: keep both rows (scope never shrinks) — ADR it.
2. Money Matters, Reports, Guide have no v2 folder: gallery view + wireframe → Nimish approval.

## Blocked / open questions

- **G1.2a needs Nimish:** duplicate ticket column is pinned by the frozen answer key (`workbook-export.json`, 30 cols).
- Compare shows "Spares cost ₹ 0" to every role as a placeholder (`docs/loop/handoff/g16-money-tests.md`) — product call.
- **G1.4 Shift KPIs + Energy:** wireframes need Nimish's `loop approve`. Nimish (old): branch protection; answer-key last digit; support tickets 0 downtime.

## Don't repeat

- `gh pr update-branch` on a ticket PR makes main's files look like builder changes (guard diffs from `Plan-base`). Instead: merge main into `plan/t<N>`, merge the seed into the PR branch, repoint `Plan-base`.
- loop-guard reads the PR body from the triggering event: after `gh pr edit`, push a commit (empty is fine) to re-check.
- `Screens:` needs full ids (`S12-problem-analysis`), not `S12`. Builder handoff notes need Prettier before CI.
- After seeding, push `plan/t<N>` and check `git ls-remote` before `loop prep`. Always `gh pr edit --body-file` after `loop finish`.
- `cd` into the main checkout + git write in one Bash call → guard says "you're on main"; use a `/tmp` worktree.
- Hidden tests go in a `holdout/` folder the test command reaches; `tests/holdout/` never runs.
