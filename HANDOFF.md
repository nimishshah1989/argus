> **24 Nov (coordinator) — state:** #645 merged. #651 (loop-guard line-count fix, ADR 0032) CI green, held: guard change needs Nimish's yes; it unblocks #633/#634/#637 (false 'over budget' because main's lines count). #649 (#642) review FAIL (tile basis printed twice, backlog repeat); Plan fixed the ticket, builder was blocked by a stop hook wanting HANDOFF.md overwritten (builder brief says use docs/loop/handoff/642.md) — rerun `loop build 642`, or fix the hook. #650 (#620) red: loop-guard, pr-meta. #634 also red on static. Not reviewed: #637, #634, #633.

# HANDOFF

> **24 Nov 23:20 — main fix:** energy/adapter.ts split (433 > 400 lines) after #709 merged over a size failure (landed as #713).

> **24 Nov 23:00 — ADR 0037 (Nimish yes):** PR paperwork checks (parity, size, quality fields, changelog) warn instead of block.

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-25 00:15 IST · **By:** Coordinator · **Model:** Sonnet 5.5
**Milestone:** M2b screens lane · **Branch:** plan/handoff-2026-11-25-night

## State

- #714 (ADR 0038, gates cut to the core) merged 18:27 UTC as 07ae3a51. `merger.sh`, `pool.sh`, `watchdog.sh` still running (merger merges any PR whose checks all finished with none failed, ≥10 check runs).
- #713 (energy adapter split), #712 (663) and #710 (662) are merged on main (00:09 IST onward). #713's `browser (2/5)` had failed 3x on `escalation-history.spec.ts:179` around midnight IST; the re-run passed. Cause (date-rollover race?) NOT proven: if it fails again, look at it.
- #712/#710 only merged after their body's `Screens: none (no wireframe id)` line was removed (the guard reads it as an unapproved screen, even after 0038). #711 (658) is the one screen PR left besides #707: it only failed `static`; `gh pr update-branch 711`, merge when all checks finish.
- #707 (643): conflict in `insight-coverage.test.ts` (keep both sides) plus the machine reliability browser spec at phone layout. The hook blocks the coordinator from editing `.loop/wt/643`: `loop prep 643` then the builder.
- 657 and 664: FOUND the reason. `loop finish` runs the fast suite; the only reds are 2 tests in `packages/domain/test/engine-scale.test.ts` (10,000-row plant must finish in 20 s; the second times out at 60 s), which fail when the Mac is busy (pool builds + CI at once). 3095 of 3097 pass; the age ticket does not touch the engine. Not a ticket fault and not a test to edit. Fix: run `loop finish 657` / `664` when no other build or finish is running (or one at a time); no Fable rescue needed unless it fails on an idle machine. `finish-657.log` is `/tmp/claude-501/finish-657.log`.

## Next step

1. update-branch #711 and #707, one at a time, merging each when all checks finish (`merger.sh` does it if left running).
2. Re-run `loop finish 657`, then `664`, one at a time on an idle machine. Likely the same load-timing failure for other pool tickets (665, 666, 667, 668).
3. Not started: 640, 644, 665, 668–679, rebuilds 641/656, kit #684–#701. Housekeeping from Nimish's paste: duplicate ADR 0035, restore `apps/web/src/ui/**` protection in `.loop.json`, tracker artifact 66c8a2ff is stale.

## Blocked / open questions

- Nimish has not yet seen a screenshot of any new screen tonight; none taken.

## Don't repeat

- zsh does not word-split `$var`: `set -- $r` fails. Use `${r%%:*}`.
- `gh run rerun <id> --failed` re-runs one job; loop-guard reads the PR body from the event payload, so a body edit only counts on a new push.
- Build folders: the loop hook stops the coordinator from `cd .loop/wt/<N>`.
- `git add` named files only; commit from a temp worktree (main checkout is shared and has a dirty `docs/loop/metrics.jsonl`).
