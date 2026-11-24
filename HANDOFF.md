# HANDOFF

> **24 Nov 16:40 — PR #651** applies ADR 0032 §1 (budget lines count only the PR's own files). CI green, **not merged: waiting for Nimish's yes**. Before: #633 461 lines, fail. After: passes.

> **Read ADR 0012, 0026, 0028, 0030, 0031 first.** Nimish wants the loop to run itself (`loop auto`, fresh Sonnet coordinator sessions, Opus via `loop plan`); he should not have to chase. Report only: screen 1 as HTML, history counts, blockers.

_Overwritten at the end of every session. Facts only._

> **24 Nov — ADR 0032 (Plan):** loop-guard counts main's merged-in lines against ticket budgets. The one-line `check_pr.py` fix is in the ADR, **needs Nimish's yes** (guard change). #633/#637/#634 are within budget; no splits or budget edits. #634's test rewrite is legitimate; its PR body carries `Tests removed:` → ADR 0032. After the fix merges, merge main into 633/637/634.

**Updated:** 2026-11-24 16:25 IST · **By:** coordinator (long chat session, handing to `loop auto`) · **Milestone:** M2b screens lane + M3 history lane

## State

- **ADR 0031 (#645, plan/screens-batch1):** screens batch 1 decisions for #640–#644 (takeaways, file lists, C-shift finding). Seeds follow it.
- **Merged today:** #646 (619 kit: four takeaway rules + tile yardstick), #639 (635), #638 (guard fix), #631 (kit carve-out).
- **History load on staging (Mac `~/argus-logs/history-load3.sh`, log `history-load3.log`):** running since 16:12 via `tools/load-legacy.ts --data ~/argus-data/flat --tenant cosmos --retired drop`. Read phase done: tickets to load 2022 892, 2023 1106, 2024 1045, 2025 1177 (4220). **Not yet confirmed in the DB**: wait for a `LOAD EXIT` line, then count rows per year in staging and compare MTTR/MTBF to the workbook sheets. Rollback = RDS snapshot `uptimo-before-history-load-202611241554`. Tunnel: kill stale `session-manager-plugin` before restarting (a 14:29 one held port 15432 and hung the first run).
- **Screens:** #642 Shift KPIs (Haiku) building via `~/argus-logs/lane-642.sh`; #620 (insight tables) seed rebased by Opus, rebuilding via `plan-620.sh`. When 642's PR is green: render the screen to self-contained HTML + screenshot and send Nimish (his ask). Then 641, and after 620 merges 640 + 643; #644 (S22) is over budget, needs a plan split.
- **16:25 finding:** #642 built, its tests pass (3066), but `pnpm ui:check` fails: seed test titles hold `(#642)` and `#642` reads as a raw hex colour. A plan job is rewriting `#N` to `ticket N` in seeds 640-643 (`~/argus-logs/fix-seeds.sh`, log `fix-seeds.log`), then rebuilds 642 and 641 and finishes them. Do not start those builds again while it runs. #620 is building (`plan-620.log`).
- **Real red, not stale:** #633 is over its size budget (4 files / 461 lines vs 6 / 90): split or rule via `loop plan`. #645 was Prettier on ADR 0031 (fixed, pushed). #634 pr-meta: quality:pr verdicts; read the log.
- **Open PRs:** #645 (ADR 0031, screens batch 1) and #633/#634/#637 (M3-H1/H2/H3) were red on stale checks; branches updated to main at 16:20, re-check. Merge each when green.
- **After #620 merges:** restore `apps/web/src/ui/**` in `.loop.json` via a plan PR (ADR 0028 addendum).

## Next step

1. Check `history-load3.log` for LOAD EXIT; verify counts in staging; report per year. 2. Merge green PRs (645 first, then 633, 634, 637). 3. Send Nimish screen 1. 4. Update the tracker artifact (66c8a2ff-0830-443b-9f71-6b36d53fa901).

## Blocked / open questions (Nimish)

- Answer key books 2 breakdowns (3.00 h) to "shift 3 (no window)" and prints 21.0 working hours/day; conflicts with the 2-shift, 16 h decision. Which is right for the figures?
- For Bhavin: sheet "STAR" in 2022-23; confirm only TC-3, TC-5, VC-6 are spare; 14 unmapped fault codes (loaded blank); ~10 impossible-year rows left out.
- Nimish later: make repo private; upload `~/cornerstone/_upload-to-google-drive`; ask Bhavin whether support tickets count as zero downtime.

## Don't repeat

- Never load legacy years with `pnpm import:bhavin`; only `tools/load-legacy.ts`. Don't pipe a long job through `tail` (no output for minutes); log to a file and check the process.
- Check a background job's process and log every few minutes; a silent step over 10 min is a stall, not progress.
- Update a PR's branch (`gh api -X PUT .../pulls/N/update-branch`) before reading red checks; most reds were stale.
