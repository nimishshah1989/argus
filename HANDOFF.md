# HANDOFF

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-25 00:15 IST · **By:** Coordinator · **Model:** Sonnet 5.5
**Milestone:** M2b screens lane · **Branch:** plan/handoff-2026-11-25-night

## State

- #714 (ADR 0038, gates cut to the core) merged 18:27 UTC as 07ae3a51. `merger.sh`, `pool.sh`, `watchdog.sh` still running (merger merges any PR whose checks all finished with none failed, ≥10 check runs).
- #713 (energy adapter split, fixes `static` on main): updated onto main, body now `Screens: S21-energy`. Its `browser (2/5)` failed 3x on `escalation-history.spec.ts:179` ("Acknowledge" expected, "Start work" shown) around 23:57–00:01 IST. Suspected date-rollover race, NOT proven. Failed job re-run (run 45459725813) at 00:05 IST: read its result first.
- #710, #712: Screens line removed from the body (`Screens: none (no wireframe id)` is read as an unapproved screen, even after 0038). #711 only fails `static`. All three fail `static` only because main has the 433-line energy adapter: after #713 merges, `gh pr update-branch` each (a fresh push is needed so loop-guard re-reads the edited body).
- #707 (643): conflict in `insight-coverage.test.ts` (keep both sides) plus the machine reliability browser spec at phone layout. The hook blocks the coordinator from editing `.loop/wt/643`: `loop prep 643` then the builder.
- 657 and 664: FOUND the reason. `loop finish` runs the fast suite; the only reds are 2 tests in `packages/domain/test/engine-scale.test.ts` (10,000-row plant must finish in 20 s; the second times out at 60 s), which fail when the Mac is busy (pool builds + CI at once). 3095 of 3097 pass; the age ticket does not touch the engine. Not a ticket fault and not a test to edit. Fix: run `loop finish 657` / `664` when no other build or finish is running (or one at a time); no Fable rescue needed unless it fails on an idle machine. `finish-657.log` is `/tmp/claude-501/finish-657.log`.

## Next step

1. Read result of run 45459725813; if green, merge #713 (all checks finished). If the same spec fails again at a non-midnight time, it is a real regression on main: look at it first.
2. Then update-branch #712, #711, #710, #707 one at a time, merging each when all checks finish.
3. Re-run `loop finish 657`, then `664`, one at a time on an idle machine. Likely the same load-timing failure for other pool tickets (665, 666, 667, 668).
4. Not started: 640, 644, 665, 668–679, rebuilds 641/656, kit #684–#701. Housekeeping from Nimish's paste: duplicate ADR 0035, restore `apps/web/src/ui/**` protection in `.loop.json`, tracker artifact 66c8a2ff is stale.

## Blocked / open questions

- Nimish has not yet seen a screenshot of any new screen tonight; none taken.

## Don't repeat

- zsh does not word-split `$var`: `set -- $r` fails. Use `${r%%:*}`.
- `gh run rerun <id> --failed` re-runs one job; loop-guard reads the PR body from the event payload, so a body edit only counts on a new push.
- Build folders: the loop hook stops the coordinator from `cd .loop/wt/<N>`.
- `git add` named files only; commit from a temp worktree (main checkout is shared and has a dirty `docs/loop/metrics.jsonl`).
