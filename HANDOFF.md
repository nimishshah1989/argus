# HANDOFF

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-25 · **By:** Plan · **Model:** Opus 5.5
**Milestone:** M2b screens lane · **Branch:** plan/kit-carve-out-0036

## State

- **Kit carve-out (ADR 0039, Nimish yes 25 Nov):** PR on `plan/kit-carve-out-0036` opens 13 kit files to builders (685 686 691 692 694 695 696 697 699 700 704). Every kit ticket 684–704 checked against the new list with loop-guard's `matches()`: none needs another locked file. Ends when 684–704 merge: restore `apps/web/src/ui/**` (also closes ADR 0028 §4, which was never restored after #620).
- origin/main is at 6835d813. Merged tonight: #702 #709 #710 #712 #713, CI gates cut (#708 ADR 0037, #714 ADR 0038). Open PRs: #711 (658) and #707 (643); #300 is a parked docs PR.
- #711: only `browser (2/5)` (`escalation-history.spec.ts:179`) and `browser (3/5)` (`who-is-acting.spec.ts`, `page.goto ERR_ABORTED`) failed. I ran `gh run rerun 45459761692 --failed`; at 00:35 IST the run was in progress, result not seen. `merger.sh` merges it when all checks finish clean.
- Pattern: `escalation-history.spec.ts:179` failed on #713 and on #711, both inside 23:55–00:03 IST (18:25–18:33 UTC). Looks like an IST-midnight date rollover; not proven. If it fails again after midnight, it is a real bug: file a ticket.
- #707 (643) is DIRTY (conflict in `insight-coverage.test.ts`, keep both sides). The hook blocks the coordinator from `.loop/wt/643`: `loop prep 643`, then the builder.
- Load average was 55: `pool.sh` x6, `merger.sh`, several `loop build/finish` at once. The two engine-scale tests time out under that load, so finishes fail for a reason that is not the ticket.

## Next step

1. Check #711 merged (`gh pr view 711`), then #707 as above.
2. Merge the ADR 0039 carve-out PR when green, then restart the kit pool jobs (685 686 691 692 694–697 699 700 704).
3. Run `loop finish` one at a time on a quiet machine: 657, 664, 665, 666, 667, 668. Do not start new builds while the load is above ~10.
4. Kit tickets that can build now (no protected file): 684, 687, 688, 689, 690, 693, 698, 701, 703. Not started: 640, 644, 669–679.

## Blocked / open questions

- 666 and 667: builders reported BLOCKED because `pnpm typecheck` was denied in the background session. `loop finish` runs the gate itself.
- Still open from before: Robots colour (#706, #700); #705 which 3 figures; S22 "vs the 320 days before" (#679); #651; S27–S30 wireframes wait for Nimish.

## Don't repeat

- Check `.loop.json` `protected` against a ticket's "Files to change" before building a pool: outside a carve-out, a CSS file under `apps/web/src/ui/` is protected.
- `loop finish` under heavy load fails on `engine-scale.test.ts`; that is load, not the ticket. One at a time.
- `git add` named files only; commit from a temp worktree (the main checkout has a dirty `docs/loop/metrics.jsonl`, not committed here).
- zsh does not word-split `$var`: use `${r%%:*}`.
