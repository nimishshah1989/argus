# Where things stand — handoff for the next orchestrator session

Read this first, then `docs/plan/ledger.md` (17–18 Nov, last lines), then `docs/plan/MILESTONES.md`. Under 50 lines; rewrite at session end.

## START HERE (review 41b → M4a tail → gate → M4b → M6)

**State:** `main` = `4efd5d3e`. M2 accepted. **Ticket 41 is complete. Ticket 42 is complete** — A9 and the
Forecast Lab equal their keys and their screens are live (#344–#347, #350). **Ticket 43's four figures are exact against
their keys** (Compare #352, Team Focus #355, Money Matters #351, Fix Finder #353); their screens are the remaining 43
packet. **M4a: 36–42 done; the frontier is 43e screens**, then 44 Action Center, 45 reports/export/Guide, then
`docs/plan/gates/M4a.md`. Only other open PR: #300 (Nimish's, leave it).

**The answer key's authority is the 11 Nov platform build, tracked in this repo** at
`docs/discovery/real-2026-11-13/cosmos_platform-2026-11-11.html` (3.7 MB, MD5 `896faf97429d976903f0645c8c6d3d74`; the
workbook is beside it). The earlier "not committed" note was wrong and is corrected here. The committed
`docs/discovery/source/cosmos_platform.html` is a **different build** (no per-machine efficiency, no A10 card, no manual
fixes in `probEvents`); the plan's 41b/41d state both divergences. Regenerate keys only from the 11 Nov file.

**R8 — do not undo.** The pseudonymiser collapsed name forms, so nine A4 mentions were over-attributed; the fixture-side
map `fixtures/answer-key/person-mentions.json` repairs it and the seam test proves it is applied.

**First action:** in a fresh worktree from `origin/main`, `git fetch origin --prune`, refresh Graphify
(`GRAPHIFY_BACKEND=none graphify update .`), read this → ledger tail → MILESTONES → the 42 plan, then plan and dispatch 43e.

**Frontier:** 42 forecast (seed scheme in `fixtures/answer-key/README.md`: A9, planning forecast, Forecast Lab),
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
CSV not XLSX for the cell-log export (ADR needed); N5 real Gujarati copy blank; A10's group-editor write and the "What
stands out" card are recorded debt (R4/R9, `docs/plan/DEBT.md`). Recorded follow-ups: split the 700-line e2e spec; an
A2/A3 over-cap variant; a stale doc comment in figure-content.ts; the move-correction row lock.
