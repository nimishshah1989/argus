# HANDOFF

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-25 ~15:50 · **By:** Coordinator (pages + Money Matters) · **Model:** Opus 5.5
**Milestone:** M2b screens lane · **Branch:** plan/handoff-sweep-706b

## State

- Money Matters: #644 (PR #745) and #678 (PR #748) MERGED earlier. #679 (go-live at /analytics/cost, v1 MoneyPage deleted): build 1 BLOCKED (ModelKey in `v2/live-frame.tsx` not on the file list). Coordinator amended issue #679: added that file, Budget files<=5 lines<=175. Build 2 code DONE; `loop finish 679` failed only on prettier for `docs/loop/handoff/679.md`; build 3 started in the background ~15:29 (pid 90936). The 679 Done-when needs **Nimish's written yes on the unbuilt "+8% vs 320 days" yardstick row** before merge.
- Batch tickets cut by Plan: **#750 A** (dashboard keeps bubble, no Quadrant), **#751 B**, **#752 C**, **#753 D**; seeds `plan/t750..753`. Their "Files to change" lists were numbered (`1. path`), which `loop prep` can't parse: coordinator rewrote them as `- \`path\` — change` (no file changed). All four prepped and building in the background since ~15:29 (pids 90835/45/55/65). Next: `loop wait <N>`, `loop finish <N>`, reviewer, merge on PASS + green.
- Plan note: C (#752) still turns problem-analysis scatter into a Quadrant per ADR 0041; Nimish's "keep bubble" was said about the dashboard. Confirm with him before merging #752 if unsure.
- #643 / PR #707: only failing check is loop-guard: "existing test modified on a build branch" (`apps/web/e2e/analytics-machine-reliability.spec.ts`, '4.0'→'4.0 Loss', '13.3'→'13.3 Loss'). `loop prep 643 --fresh` done (wt clean, main merged in at d11eef93). Fix = Plan commits that exact test change on `plan/t643` (a1b73df7), merges main in, and #707's body `Plan-base:` points at the new seed sha (check_pr.py lines 71-83). Do NOT land it on main alone (makes main e2e red). One attempt; else close #707.

## Blocked

- #679 merge: Nimish's written yes on the unbuilt yardstick row.

## Don't repeat

- Never chain `loop wait N && loop finish N`: wait prints "still building" and exits 0, so finish runs during the build.
- Planner-written issues must use `- \`path\` — note` lines under "## Files to change" or `loop prep` refuses them.
- Builders must never `git pull`/merge.
