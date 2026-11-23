# HANDOFF

> **24 Nov — ADR 0016 (Nimish: yes to all):** Breakdown Log Excel keeps both ticket columns, screen + CSV show one (G1.2a unblocked); draft Shift KPIs + Energy wireframes for his approval; answer key stays frozen; budget 150k; helpers = `helper` (Sonnet), never general-purpose.

> **Read ADR 0012 first.** Nimish is away; the loop runs unattended. Plan decides §6 (ADR each) except answer-key changes, production, money, irreversible data steps.

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-24 · **By:** Plan · **Model:** claude-opus-5-5
**Milestone:** M2 Finish the analytics redesign (building) · **Branch:** plan/e2e-who-is-acting-flake

## State

- Merged: **#583** TF-2 (reviewer PASS after 1 fix: unknown status counts as open; #579 closed).
- **#592 TF-3** (#580, Team Focus live + saving, v1 deleted): builder attempt 4 addressed review 1 (no table filtering on owner drawer; "I'll take it" shows failures + disabled until user known; EditForm keyed on row id). CI all green except `browser (3/5)` = known who-is-acting flake → rerun of run 45289148683 pending. Body is `/tmp/b580.md`-style (Plan-base `ed282b10`). Next: `loop ci 592` → **reviewer (second review)** → merge → `loop clean 580`. Attempts used 4/3+: a further failure → `--rescue`.
- Compare seeds refreshed onto main: `plan/t584` `3fea68ee`, `plan/t586` `f0043b3a` (merge main again before prep if main moved).

## Next step

1. Finish #592 (above). 2. Compare #584 CMP-1 and #586 CMP-3 (no blockers) → #585 → #587 → #588. 3. Then M2 wireframes (Money Matters, Monthly, Annual, Guide, Settings) → Nimish.

## Blocked / open questions

- **Wireframes for Shift KPIs + Energy, Money Matters, Monthly, Annual, Guide, Settings** need Nimish's sign-off.
- Untested by unit tests (no DOM test setup in apps/web): TF-3 "Saved." surviving a refresh, "I'll take it" failure path — reviewer must read the code.
- For Nimish: ADR 0019 extra drill on Data Checklist; Compare spares ₹0 frozen; ADR 0020 §5–6 "later" items on Team Focus.

## Don't repeat

- `loop finish` overwrites the PR body with a thin one every run: keep a full body file, re-apply it (`gh pr edit --body-file`) and push an empty commit from a `/tmp` worktree so pr-meta/loop-guard re-read it.
- After any seed change: merge seed into the build folder (`cd .loop/wt/<N> && git merge origin/plan/t<N>` as its own Bash call), set `Plan-base` to the new seed sha.
- Orchestrator can't run tests in `.loop/wt/` (hook); start Bash calls that touch `/tmp` with `cd /tmp && …`, never chain a `cd` into a wt folder with other commands.
- **Never force-push.** Write "ticket N" in code comments, never `#N`. Every PR needs `changes/<N>-*.md`.
