# HANDOFF

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-25 00:40 IST · **By:** Coordinator · **Model:** Sonnet 5.5
**Milestone:** M2b screens lane · **Branch:** plan/handoff

## State

- origin/main is at 6835d813. Merged tonight: #702 #709 #710 #712 #713, CI gates cut (#708 ADR 0037, #714 ADR 0038). Open PRs: #711 (658) and #707 (643); #300 is a parked docs PR.
- #711: only `browser (2/5)` (`escalation-history.spec.ts:179`) and `browser (3/5)` (`who-is-acting.spec.ts`, `page.goto ERR_ABORTED`) failed. I ran `gh run rerun 45459761692 --failed`; at 00:35 IST the run was in progress, result not seen. `merger.sh` merges it when all checks finish clean.
- Pattern: `escalation-history.spec.ts:179` failed on #713 and on #711, both inside 23:55–00:03 IST (18:25–18:33 UTC). Looks like an IST-midnight date rollover; not proven. If it fails again after midnight, it is a real bug: file a ticket.
- #707 (643) is DIRTY (conflict in `insight-coverage.test.ts`, keep both sides). The hook blocks the coordinator from `.loop/wt/643`: `loop prep 643`, then the builder.
- Load average was 55: `pool.sh` x6, `merger.sh`, several `loop build/finish` at once. The two engine-scale tests time out under that load, so finishes fail for a reason that is not the ticket.

## Next step

1. Check #711 merged (`gh pr view 711`), then #707 as above.
2. Nimish decides the carve-out (below), then `loop plan "Open <files> to builders for kit tickets, ADR 0028 §4 precedent"`.
3. Run `loop finish` one at a time on a quiet machine: 657, 664, 665, 666, 667, 668. Do not start new builds while the load is above ~10.
4. Kit tickets that can build now (no protected file): 684, 687, 688, 689, 690, 693, 698, 701, 703. Not started: 640, 644, 669–679.

## Blocked / open questions

- **Needs Nimish's yes:** the ADR 0028 §4 carve-out lapsed after #620, so builders cannot edit these kit files: 685 `kpi-tone.css` · 686 `cards.css` · 691 `action-strip.css` · 692 `severity-row.css` · 694 `ranked-bars.css` · 695 `pareto.tsx` + `domain.css` · 696 `domain/heat-matrix.tsx` · 697 `quadrant.css` · 699 `reason-chip.css` · 700 `entity-chip.tsx` + `v2.css` · 704 `verdict.tsx` + `v2.css`. The guard hook refused the edit in `b-685.log` and `b-686.log` (nothing committed). The pool will spend its 3 attempts on each for nothing: stop those pool jobs until this is settled.
- 666 and 667: builders reported BLOCKED because `pnpm typecheck` was denied in the background session. `loop finish` runs the gate itself.
- Still open from before: Robots colour (#706, #700); #705 which 3 figures; S22 "vs the 320 days before" (#679); #651; S27–S30 wireframes wait for Nimish.

## Don't repeat

- Check `.loop.json` `protected` against a ticket's "Files to change" before building a pool: a CSS file under `apps/web/src/ui/` is always protected.
- `loop finish` under heavy load fails on `engine-scale.test.ts`; that is load, not the ticket. One at a time.
- `git add` named files only; commit from a temp worktree (the main checkout has a dirty `docs/loop/metrics.jsonl`, not committed here).
- zsh does not word-split `$var`: use `${r%%:*}`.
