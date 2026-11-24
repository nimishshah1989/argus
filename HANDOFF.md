# HANDOFF

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-24 17:25 IST · **By:** Plan · **Model:** Opus 5.5
**Milestone:** M2b screens lane + M3 history lane · **Branch:** plan/loop-guard-budget-lines · **PR:** #651

## State

- Tests: `pnpm exec vitest run tools/check-pr-budget.test.ts` 1 passing (red before the fix: old guard said 3 files / 142 lines, truth 2 / 4).
- Last thing done: reworked #651 after review FAIL. The budget diffs the build against "seed on top of the main it merged" (`git merge-tree`), `-M` counts a rename once, and main's and the seed's lines never count, even in shared files. Fallback shortcut recorded in ADR 0032 §1.
- Real branches with the new guard: #633 4 files / 36 lines, #637 2 / 56, #634 4 / 69. All inside budget (old guard: 461 / 481 / 494, fail).
- Read ADR 0012, 0026, 0028, 0030, 0031, 0032 first. Nimish wants the loop to run itself (`loop auto`); report only screen 1 as HTML, history counts, blockers.
- Carried from the 16:25 coordinator handoff, **not rechecked by this session**: history load running (`~/argus-logs/history-load3.log`, rollback snapshot `uptimo-before-history-load-202611241554`); seeds 640–643 `#N` → `ticket N` fix running (`fix-seeds.log`), then 642 and 641 rebuild; #620 building (`plan-620.log`); #644 over budget, needs a plan split. After #620 merges, restore `apps/web/src/ui/**` in `.loop.json` (ADR 0028 addendum).

## Next step

#651 CI is green (`loop ci 651`), not merged. Get Nimish's yes on #651 (guard change), merge it when CI is green, then merge main into #633, #637, #634 and merge each when green.

## Blocked / open questions

- Nimish: yes/no on #651 (ADR 0032 §1).
- Nimish: answer key books 2 breakdowns (3.00 h) to "shift 3 (no window)" and prints 21.0 working hours/day, against the 2-shift, 16 h decision. Which is right?
- Bhavin: sheet "STAR" in 2022-23; only TC-3, TC-5, VC-6 spare?; 14 unmapped fault codes; ~10 impossible-year rows; do support tickets count as zero downtime?
- Nimish later: make repo private; upload `~/cornerstone/_upload-to-google-drive`.

## Don't repeat

- `--no-renames` + a path filter (first #651 attempt): counts renames twice and still counts main's lines in shared files.
- Never load legacy years with `pnpm import:bhavin`; only `tools/load-legacy.ts`. Log long jobs to a file; a silent step over 10 min is a stall.
- Update a PR's branch before reading red checks; most reds were stale.

## Files touched this session

- `.github/loop/check_pr.py` — budget counts only the build's own work.
- `tools/check-pr-budget.test.ts` — temp-repo test: main merged in, a rename, a shared file.
- `docs/adr/0032-budget-lines-and-624-test-rewrite.md` — §1 describes the applied fix and its shortcut.
- `changes/651-guard-budget-lines.md` — changes note.
