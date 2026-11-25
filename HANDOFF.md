# HANDOFF

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-26 · **By:** Coordinator (Sonnet 5.5) · **Goal (Nimish):** all screens live on the newest kit · **Branch:** plan/handoff-s26

## State

- MERGED this session: #787 (context 350k), #786 (S26 ADR 0047), #797 (main green after #781: Dashboard e2e fixes, ADR 0048), #796 S26-1 Settings shell + Jobs (merged by a parallel `loop auto` session while I re-reviewed; reviewer round 2 said FAIL, follow-ups are in the "S26-1 follow-ups" GitHub issue).
- #781 sweep A had merged with red e2e; #797 repaired main. Lesson: never merge with red browser shards.
- S26 issues #788–#795 and seeds `plan/t788`..`t795` exist. #789–#795 can build in any order.
- Open PRs: #782 Monthly (#763) and #783 sweep B (#751): loop-guard comment text fixed and pushed; CI not re-read. #782 had e2e reds (analytics-reports.spec.ts:101, analytics-shell.spec.ts:19, v2-shell.spec.ts:95): rerun after the #797 fix before treating as real.
- S27–S30 builds #767/#769 sit in other sessions' `.loop/wt/`; no PRs seen. Not started: #765 S24 Annual, sweeps #752/#753.
- Flakes: pm-plans.spec.ts:94 (two "Start work" buttons, passes on retry), who-is-acting:219, detail-downtime:7, desk lifecycle 409, desk-lists:11.
- `loop auto` is running in the background; do not start another.

## Next step

1. `loop ci 782`, `loop ci 783`; merge when green and reviewer PASS, one at a time.
2. Plan and build the S26-1 follow-ups issue, then S26-2..8.
3. Then #765 S24, #752, #753, S27–S30 finish.

## Don't repeat

- After a plan fix, set Plan-base in the PR body to the new `plan/tN` tip, then close and reopen the PR (re-running a run reuses the old body). `loop finish` drops a server-side merge of plan/tN: merge it again after finish.
- Plan-owned files (scope docs, tests) can't be changed by builders: send to `loop plan`.
- `loop build N` reads the issue BODY. Don't poll with `pgrep -f` in the same shell (matches itself).
- The S27–S30 approvals are still uncommitted in the main checkout.
