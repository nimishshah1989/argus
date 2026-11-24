# HANDOFF

> **24 Nov 12:30 — ADR 0026 (Nimish):** Cosmos runs **two shifts (A, B), 16 h; no C shift** — drop C from S20/S26 and any fixture. S20–S26 are **approved** (#617); S27–S30 still need redrawing under ADR 0023 before he approves. From loop 0.8.0 you coordinate on **Sonnet** and send every planning job to Opus with `loop plan "<job>"`; **no handoff-only PRs** — use the standing `plan/handoff` branch. **Two lanes (ADR 0026 §3):** screens (S20–S26, then M2b) and history (M3 history load, from `docs/slices/69-legacy-history.md`, amended 24 Nov; #300 closed) run side by side — `loop plan` the history tickets now. **M2b by rules in the kit (ADR 0026 §4):** make the shared table and tiles insight-aware with four takeaway rules first, then small per-screen declaration tickets — not hand redesigns.

> **24 Nov — History lane tickets exist (Plan).** All 20 workbooks are on Nimish's Mac at `/Users/nimishshah/argus-data/history/{2022,2023,2024,2025}/*.xlsx` (never into git; pass the folder as `--data`). 2023 is in (3,075 rows, 1,823 of them UTI); `Jul-23.xlsx` is a July grid, cross-check only. Converter gaps, label `lane:history`, all M3: **#623** review tray + later-dated rows held — **seeded on `plan/t623`, ready**; **#624** two-shift fold, other shifts held (seed after 623 merges; its seed rewrites the two old shift-fold tests); **#625** `import:legacy --grid` July 2023 cross-check (seed after 623). Plus ADR 0027's **621** (seed `plan/t621` still not written) → server setting → 69d. Nothing goes to staging before 621 + the setting merge and Nimish uploads the files. Plan text: `docs/slices/69-legacy-history.md` "Amendment, 24 Nov".

> **24 Nov — History lane (Plan, ADR 0027), stopped at context budget.** Found: 2026 parity breaks once 2022–2025 is loaded (no span in production; Dashboard totals, A2 and the breakdown log read all years). Decided: data-from cut (ADR 0027). Done: issue **621** (domain cut). **Its seed `plan/t621` is NOT written yet.** Skeleton: `EngineSettings.dataFrom` in types.ts and a `dataFrom()` stub in as-of.ts. Visible test `packages/domain/test/history-parity.test.ts`: ENGINE_DATA plus a copy shifted to 2024 and 2022 with prefixed ids, `dataFrom: '2026-01-01'`, and the `figures` must deep-equal the 2026-only run. Hidden tests go in `packages/domain/test/holdout/`. Issue 621's body has `<N>` placeholders to replace with 621. Next: issues and seeds for the server setting ticket and the 69d job (ADR 0027 §4). Then two blocked issues for Nimish. (a) Upload the 19 workbooks (2022: HMC, TC & TMC-Star, VMC, VTL; 2023–2025: those plus GRD) to the private backup bucket `legacy/<year>/`, and record N14 (real Cosmos data on staging; NEEDS.md says open). (b) Bhavin's 5 summary-sheet counting questions (69c evidence) and N17 (Feb–Mar 2022). G3.1 needs all 229 unexplained machine-months explained. Also: refresh `plan/t607` from main, close #300, update PROJECT.md M3 test lines.

> **24 Nov 10:15 — ADR 0023 Insight first (Nimish):** screens feel flat. Redraw S20–S26 under UX rules 60–67 before asking for approval; run **M2b Insight pass** (one ticket per live v2 screen) before the rest of M2. Reviewer fails any screen without takeaway + marked outlier + yardstick.

> **Read ADR 0012 first.** Nimish is away; the loop runs unattended. Plan decides (ADR each) except answer-key changes, production, money, irreversible data steps.

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-24 · **By:** Plan · **Model:** claude-opus-5-5
**Milestone:** M2b Insight pass (planning) · M3 G3.2 pulled forward (ADR 0024) · **Branch:** plan/handoff-m3-606

## State

- **#609** gallery fix: `analytics-order` SCREENS/PRINTED emptied (v1 Compare deleted by ticket 588; v2 Compare has `v2-compare.spec.ts`); the empty spec + data files can be deleted later. Seed 606 refreshed (older figure tests warm first; DEBT line).

- Merged: **#603** CMP-5 Compare live, v1 MachinesPage deleted (588 closed; Compare done in M2) · **#608** ADR 0024 (figures never computed in a read; tickets 606, 607 seeded) · **#605** wireframes S27–S30 (Floor, Desk, Ticket, Board; drafts, questions for Nimish in the PR body).
- **606** (M3-1 served-warm) → PR **#610**, CI RED: `api (2/5)`, `api (3/5)`, `static`, `pr-meta`. pr-meta = auto body; full body drafted at `/tmp/body606.md` (Plan-base `b06f1af6…`). api/static tails not read yet. Attempts used: 1.
- **607** (M3-2 load script) blocked by 606; seed `plan/t607` (merge main into it first).
- **S20–S26 redrawn** insight-first: merged **#612** (waits for Nimish). **M2b kit PR #609** (PROJECT.md M2b, ADR 0025 model convention `model.takeaways`, kit `Takeaway`/`ExpandRow`, `insight-coverage.test.ts`) is RED on required `gallery (1/4)`: `e2e/gallery/analytics-order.spec.ts` still expects v1 Compare headings at `/analytics/machines?screen=compare` — main is likely red there too since #603 (its gallery jobs were skipped). Plan fixes that spec (protected) on 609's branch. M2b tickets **613** Dashboard, **614** Action Center, **615** Breakdown Log seeded on `plan/t613..615` (based on the kit branch; refresh from main after 609 merges).

## Next step

1. `gh pr edit 610 --body-file /tmp/body606.md` (rebuild from #603's body shape if /tmp is gone) → read the api/static failures with `loop ci 610` → Don't + rebuild, or fix the seed → review → merge.
2. Fix the gallery Compare spec on #609 → merge → build 613–615, then the M2b tickets (ADR 0023: before the rest of M2), then 607.

## Blocked / open questions

- **Nimish:** approve S27–S30 (PR #605) and the redrawn S20–S26. M3 G3.1 needs his workbooks (N14, N17); §6 answer-key last digit and `support` downtime.
- Follow-ups (not ticketed): Compare has no unit test that a pick keeps `screen=compare` and replaces history; a hand-typed refused pair shows the last good pair under the refused URL.

## Don't repeat

- `loop finish` writes a body that fails pr-meta: write Q1–Q16 + Reasons (`No parity:`, `Tests removed:`, `Large PR:`) to `/tmp/body<PR>.md`, `gh pr edit`, then push an empty commit from a `git worktree add --detach /tmp/e<PR>` (commit/push in a separate Bash call: the main-branch hook blocks commits from the repo root).
- A screen PR must change `scope/<screen>.md` in its own diff (Q16); if main already has it, Plan adds a dated line on the seed.
- After main moves: merge main into the seed, the seed into the PR branch, set Plan-base to the new seed sha; else loop-guard flags HANDOFF.md/ADRs as builder changes.
- Check `ls docs/adr` on origin/main before numbering an ADR (0023 collided this session).
- **Never force-push.** "ticket N" in comments, never `#N`.
