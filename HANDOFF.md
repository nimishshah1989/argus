# HANDOFF

> **Read ADR 0012 first.** Nimish is away; the loop runs unattended. Plan decides §6 (ADR each) except answer-key changes, production, money, irreversible data steps. **ADR 0015:** M1 closes without G1.2a and Shift KPIs/Energy G1.4.

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-23 · **By:** Plan · **Model:** claude-opus-5-5
**Milestone:** M1 Stabilise (finishing) · **Branch:** plan/handoff-m1-merges

## State

- Merged: #561 (G1.1), #564 (#558, G1.6, reviewer PASS).
- #563 (#552 G1.3) and #565 (#553 G1.2b): seeds `plan/t552`/`plan/t553` were never pushed, so builders ran without tests or fragments.
  Pushed and merged the seeds into both PR branches; Plan-base repointed to the seed tips; bodies rewritten. #565 reviewer PASS;
  #563 reviewer FAIL was only the missing seed (code correct). Merge both when CI is green (`loop clean 552`/`553` after).
- #556 (G1.5): CI was running; merge when green.
- #554: rebuilt `--fresh` (Haiku, change done, tests pass); `loop finish 554` was chained after the build. Check for its PR;
  then `gh pr edit --body-file` with the full Argus body (incl. `## Coverage`) and review.
- #555: seed updated (main + coverage line), not rebuilt yet: `loop prep 555 --fresh`, `loop build 555`, `loop finish 555`.

## Next step

1. Merge #556, #563, #565 when green; ship #554, #555. Tick M1 goals in PROJECT.md (ADR 0015) and mark M1 done.
2. Start M2: `to-spec` → `loop-ticket` for Compare (S15), Data Checklist (S16), Team Focus (S17); plus a ticket for
   Shift KPIs + Energy gallery views and fixtures (snapshots then wait for Nimish).

## Blocked / open questions

- **G1.2a needs Nimish:** duplicate ticket column is pinned by the frozen answer key (`workbook-export.json`, 30 cols).
- `docs/loop/handoff/g16-money-tests.md`: Compare shows "Spares cost ₹ 0" to every role as a placeholder — product call.
- Follow-ups: `packages/domain/test/export-no-database-ids.test.ts:48` "PM Reports / Data" exemption is stale after #553;
  `analytics-team-focus-no-drill.test.ts:85` should also assert drill ids `[]`.
- **G1.4 Shift KPIs + Energy:** wireframes need Nimish's `loop approve` (none exist yet).
- Nimish (old): branch protection; answer-key last digit; support tickets 0 downtime.

## Don't repeat

- After seeding, `git push origin plan/t<N>` and check `git ls-remote origin plan/t<N>` before `loop prep`: prep silently builds without a missing seed.
- `loop finish` writes a thin PR body (fails `quality:pr`) and overwrites a full one on re-finish: always `gh pr edit --body-file` after it.
- Builder folders are hook-protected: to refresh one from a new seed use `loop prep <N> --fresh`, not a merge.
- Hidden tests go in a `holdout/` folder under `tools/`, `apps/web/src/` or `apps/server/test/`; `tests/holdout/` never runs.
- Bash `>` redirects and long inline `gh pr create --body` are denied; use Write + `--body-file`.
- 23 Nov 23:20: loop-guard no longer counts the per-PR `changes/` note against a ticket's size budget (#568, loop 0.7.5). Resume M1: #563, #565, #567.
- An old build folder can't take main (guard blocks orchestrator and builder): `loop clean <N>`, sync `plan/t<N>`, `loop prep`.
- Builders: stop hook nags for HANDOFF.md in build folders — ignore it; "checks not run" under Blocked fails `loop finish`.
- `cd` into the main checkout + git write in one Bash call → guard says "you're on main"; use separate calls.
- PR bodies need "No parity: <reason>" or pr-meta fails; builder handoff notes need Prettier.
