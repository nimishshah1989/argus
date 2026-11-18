# Where things stand — handoff for the next orchestrator session

Read this first, then `docs/plan/ledger.md` (19 Nov tail), then `docs/plan/MILESTONES.md`.

## START HERE (M4b 46 → 54/67, then M6, then M3)

**State:** `main` = `151071cb`. M2 accepted. **M4a is complete and its gate is written** —
`docs/plan/gates/M4a.md`: tickets 36–45 merged, every figure whole-key exact against its frozen
11 November key, all their screens live, the workbook and report PDFs shipping under ADR 0008, and the
Guide's 36 entries explaining every figure once. Local proof on `main`: 2,803 unit/integration tests,
parity 119 rows / 0 problems, boundaries 212 files / 0, the full journey suite green after the #370 fix (317 passed, 4 skipped; the two remaining `who-is-acting` flakes pass standalone 20/20) — the two red files
locally are `tools/backup-dump` and `tools/staging-deploy`, which fail only because this checkout's
path contains a space.

**CI is blocked at the account level, not by code.** Every Actions job on every PR ends in 1–2 s with
`runner_name: ""` and "recent account payments have failed or your spending limit needs to be
increased". Ruling R10 (ledger): merges run on local evidence instead of a CI run. **Nimish must fix
GitHub → Settings → Billing → Actions (payment or spending limit), or make the repo public**; until then
no PR can go green and no deploy runs.

**Frontier:** M4b starts at ticket 46 (the one M4b migration — backup before it), then 47, 49, 51 and 52
off it; 48 and 50 follow; 53, 54 and 67 last. Then M6 (55–60). **M3 is out.** **M5 has no tickets in the
one plan** — "Plant two" is shaped only when Nimish gives the product input (`grill-with-docs`), so it is
not dispatchable yet.

**How this repo is worked (non-negotiable):** plan first + a fresh plan review; one packet = one
acceptance assertion, ≤3 files/≤150 lines (a named shared seam excepted), a named red command and green
command, no open decision; a fresh reviewer that did not write it runs the **covering suite** (never
only the named test) and returns PASS/FAIL with `file:line`; `pnpm precheck` before push; one PR per
packet, rebased, one CI run, merge one at a time, then `pnpm main:check`; never weaken a test;
whole-figure `toEqual`, no tolerance, no re-rounding; derived counts; drill ids real rows. PR bodies
follow `.github/pull_request_template.md` — the three headings, the Q1–Q15 verdict lines, and the
`Large PR:`/`No parity:` **plain** lines in Reasons. **Fragments:** `changes/<digits>-<slug>.md`, one
per ticket; when packets share it, keep every section in packet order.

**Known traps:** `check-size` counts the trailing newline (keep files ≤399 wc-lines); `migration-runner`,
`escalation` and `state-scale` flake (rerun; never change code); a checkout path with a space breaks
`tools/backup-dump` and `tools/staging-deploy` only; prettier runs over `docs/` too — format before
pushing; a shared fragment conflicts on every packet merge — resolve by keeping every packet's section
in order.

**Calls and gaps:** N12 open (the real legacy maintenance-code map is Bhavin's; 37c ships a labelled
synthetic map); CSV not XLSX for the cell-log export (ADR needed); N5 real Gujarati copy blank; A10's
group-editor write and "What stands out" card are debt (R4/R9). Report open product calls are in the
M4a gate: report tiles/prose, commentary persistence, restorable workbook, `DOC. NO.` line, Guide prose.
Recorded follow-ups: split the 700-line e2e spec; an A2/A3 over-cap variant; a stale doc comment in
figure-content.ts; the move-correction row lock.
