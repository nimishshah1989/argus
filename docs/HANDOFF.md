# Where things stand — handoff for the next orchestrator session

Read this first, then `docs/plan/ledger.md` (17–18 Nov, last lines), then `docs/plan/MILESTONES.md`. Under 50 lines;
rewrite at session end.

## START HERE (M4a tail → gate → M4b → M6)

**State:** `main` = `3382033d`. M2 accepted. **M4a: 36, 37, 38, 38.5, 39, 40 done; 41 in progress** — its slice plan
(`docs/slices/41-manpower-energy-rootcause.md`) and the **shared seam (41h, #327)** are merged. Next packets, in this
order: **41a A4**, 41b A5, 41c A6, 41c-2 saved Why-Why + server PDF, 41d-1/41d-2 A10, 41e-1/41e-2 screens. The plan
names every rule, file, red/green command and ruling R1–R9 — do not re-derive them, and do not undo R8. Only other
open PR: #300 (history plan, Nimish's — leave it).

**The answer key's authority is the 11 Nov platform build, which lives only in the staging discovery pack**
(`<argus-staging>/docs/discovery/real-2026-11-13/{cosmos_platform-2026-11-11.html, cosmos-export-2026-11-11.xlsx}`,
3.7 MB, MD5 896faf97429d976903f0645c8c6d3d74). The committed `docs/discovery/source/cosmos_platform.html` is a
**different build** (no per-machine efficiency, no A10 suggested-group card, no manual fixes in `probEvents`). The two
divergences are written out in the plan's 41b/41d; regenerate keys only from the 11 Nov file.

**R8 — do not undo.** The pseudonymiser collapsed name forms, so nine A4 mentions were over-attributed; the fixture-side
map `fixtures/answer-key/person-mentions.json` repairs it and the seam test proves it is applied.

**First action:** in a worktree, `git fetch origin --prune && git checkout --detach origin/main`, refresh Graphify
(`GRAPHIFY_BACKEND=none graphify update .`), read this → ledger tail → MILESTONES → the 41 plan, then dispatch 41a.

**Frontier after 41:** 42 forecast (seed scheme in `fixtures/answer-key/README.md`: A9, planning forecast, Forecast Lab),
43 compare/Team Focus/Money/Fix Finder (money heads+admin only), 44 Action Center (13 rules exact; snooze persists),
45 reports/export/Guide (PDFs; workbook writer under an ADR). Then **write `docs/plan/gates/M4a.md` (<30 lines)** and,
per the night exception, continue into **M4b (46–54, 67)** and **M6 (55–60)**. **M3 is out.**

**How this repo is worked (non-negotiable):** plan first + a fresh plan review; one packet = one acceptance assertion,
≤3 files/≤150 lines (a named shared seam excepted), a named red command and green command, no open decision; a fresh
reviewer that did not write it runs the **covering suite** (never only the named test) and returns PASS/FAIL with
`file:line`; `pnpm precheck` before push; one PR per packet, rebased, one CI run, merge one at a time, then
`pnpm main:check`; never weaken a test; whole-figure `toEqual`, no tolerance, no re-rounding; derived counts; drill
ids real rows. PR bodies follow `.github/pull_request_template.md` — the three headings, the Q1–Q15 verdict lines, and
the `Large PR:`/`No parity:` **plain** lines in Reasons (a bolded bullet does not count). **Fragments:**
`changes/<digits>-<slug>.md`.

**Known traps:** `check-size` counts the trailing newline (keep files ≤399 wc-lines); `migration-runner`,
`escalation` and `state-scale` flake under CI load (rerun; never change code); GitHub Actions has stalled for hours
(check job timings before debugging code); prettier runs over `docs/` too, so format a plan/ledger edit before pushing.

**Calls and gaps:** N12 open (the real legacy maintenance-code map is Bhavin's; 37c ships a labelled synthetic map);
CSV not XLSX for the cell-log export (ADR needed); N5 real Gujarati copy blank; the 11 Nov platform build is not in the
repo (committing 3.7 MB needs a decision); A10's group-editor write and the "What stands out" card are recorded debt
(R4/R9, `docs/plan/DEBT.md`). Recorded follow-ups: split the 700-line e2e spec; an A2/A3 over-cap variant; a stale doc
comment in figure-content.ts; the move-correction row lock.
