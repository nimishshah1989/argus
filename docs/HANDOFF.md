# Where things stand — handoff for the next session (human or model)

**The one plan is `docs/plan/MILESTONES.md` (ticket 91 is the redesign); everything else is detail under it.** Read this, the tail of `docs/plan/ledger.md`, then `docs/slices/v2-build.md` (section 5) (queue, recipe, ready-to-paste briefs). `git log
origin/main` and the PR list beat this text. As of 14:50 UTC, 20 Nov 2026. **Orchestrator session handed over (Nimish).** Staging deploys on every merge (`https://cosmos.3-108-95-203.sslip.io/api/v1/health` shows the commit).

## In flight at hand-over (14:50 UTC): check each against GitHub first

- PR #517 `claude/v2-go-live`: live data source, real-data drawers, Cell change log live with its v1 page deleted. CI had one gallery failure
  (the v1 order spec still listed the deleted screen); a fix was being pushed. Merge when green. First screen live.
- PRs #515, #518, #519 are MERGED (Nimish, 14:45 UTC). Still open: #517 only.
- #517 CI (head 3d7eced): `browser (3/5)` failed on `apps/web/e2e/who-is-acting.spec.ts:217` ("a wrong current password keeps the phone signed in"; 3 retries, `page.goto` ERR_ABORTED at /floor). Not an analytics test; maybe a known flaky journey, maybe caused by the PR's move of the figures hook out of `api.ts`. Re-run that job once when the run completes; if it fails again it is this PR's: root-cause it (builder branch `claude/v2-go-live`) before merging.
- PR #519: docs, one plan (this file, MILESTONES ticket 91). Merge when green.
- PR #523 `claude/v2-drill-live-main` (replaces #522, closed; same two commits replayed on main after #517 merged): wires rows-behind into the shell and cards and takes Machines register, Age,
  Footprint, Fix Finder and Problem Analysis LIVE with their v1 pages deleted. Draft. Blocked on a person deleting two gallery specs for the deleted preview pages
  (`apps/web/e2e/gallery/v2-fix-finder.spec.ts`, `v2-problem-analysis.spec.ts`; the harness blocks agents deleting tests; their assertions were ported to the real-server e2e). Then mark ready, CI, merge.
- #517 (first live screen, Cell change log) is MERGED. If staging shows a sign-in problem (one browser sign-in journey failed in its CI), that is the cause to look at.
- Builder `claude/v2-batch1-live` (rebuild Dashboard, Action Center, Machine page on real data, live, v1 deleted) was still running and NOT pushed at hand-over; re-dispatch from MILESTONES ticket 91 if no PR exists.
- Next after those: batch 4 (merged, not wired), PM Calendar and Breakdown Log going live; rebuild Data Checklist, Compare, Team Focus; then batches 5 to 7.
- Cost rules from Nimish: tests minimal (one smoke on the real server, one completeness test, ported v1 assertions); Sonnet for builders; he asked CI auto-merge
  to be enabled (repo setting "Allow auto-merge" is off; only he can tick it).

## The one job: redesign every screen in the v2 language (Nimish, 20 Nov)

- **Rule that outranks speed: a redesign never reduces scope.** Same or more detail, insight and analytics, smarter with
  our data. Each screen PR carries a coverage table (`docs/design/v2/COVERAGE.md`, `UX-RULES.md` section 11). "Not built"
  needs Nimish's written yes. Nothing is deleted from v1 until its v2 screen has a clean table.
- Look and behaviour: `docs/design/v2/UX-RULES.md`, `LANGUAGE.md`. Screen recipe: `screens/v2/<name>/{model.ts, View.tsx,
fixture.ts, tests}`, `EntityShell` (never `Shell`), kit parts only, data through `useScreenModel`, a machine, cell,
  person or decision is always an `EntityChip` (`docs/slices/entity-links.md`). `pnpm ui:check` enforces it.

## What is merged (main = c633043), all gallery-only, v1 untouched and still live

- Kit, Dashboard, entity chip + drawer in the URL (#496, #497, #500). Action Center, Data Checklist (#502), Machine page
  (#501), Team Focus, Compare (#503), CI gallery limit 15 min (#504). View any at `/gallery?view=v2-<name>`.
- 6 of about 36 screens are done. Batches left: 2 Machines register, OEM, Age, Footprint, Cell change log · 3 Breakdown Log,
  General Work, PM Calendar, Fix Finder, Problem Analysis · 4 BD% and PM split, Category and Cell, MTTR and MTBF, Manpower,
  Why-Why · 5 Energy heat map, Bottleneck, Shift-calendar KPIs, Forecast Lab, Reliability scorecard · 6 Money Matters,
  Monthly, Annual, Guide, Settings · 7 Floor phone, desk, ticket, TV board, login.

## Coverage debt (the batch-1 gate is CLOSED until cleared)

- Audit: `docs/design/v2/scope/batch1.md`. Of 187 v1 items checked across the six merged v2 screens: 28 same, 62 changed,
  **97 MISSING** (Dashboard 26 of 38, Compare 20 of 33, Data Checklist 17 of 30, Machine page 16 of 34, Action Center 14 of 36,
  Team Focus 4 of 16). Worst: no figure opens the tickets behind it (parity rule), Compare lost the health score and tables,
  Machine page lost the reliability fit and nameplate, Dashboard lost the "needs you now" strip, Data Checklist runs 5 of v1's
  16 checks, rupees show to every role (parity says head, plant head, admin only). Some v2 fixtures show data we do not collect.
- Not yet verified by a second reader: whether renamed figures keep v1's formulas. Spot-checked only the Action Center filters.
- Clear the debt, then the gate report `docs/plan/gates/M-v2-1.md` (under 30 lines), then Nimish's go.

## Waiting on Nimish (plain words, product only)

- Compare: keep v1's health score and the two tables? (my advice: yes)
- A decision's "Open full page": Action Center with it open?
- Rail: list pages inside each section, or sections only? Verdict line at body size or one 20px line?
- Keep mid-green running tiles (3:1 contrast)? Footprint meaning (assumed "20% of machines cause most hours" + cell map)?
  Older: PM hours, manpower and spend figures, staging history (69d).

## Rulings (Nimish)

**A v2 screen goes live in its own PR and the old v1 page is deleted in that PR: no gallery-only screens, no Old view, no two copies.**
Never reduce scope (above). Light checks for web and docs PRs. Everything is redesigned. Floor phone: new
look, Bhavin's step order, button order and words unchanged. Desk, ticket, TV: flow may change. Rupee figures OK. Running grey,
Waiting amber, Transferred blue; Indian grouping; system dark and light; power and air failures count in downtime. Real data
already in the public repo is an accepted risk: add NO more (never commit screenshots of Bhavin's files).

## What cost time (details in `docs/slices/v2-build.md` (section 5))

About 20 minutes from brief to an open PR, 40 to 85 to merge. Waste: PR-body lines CI checks (`No parity:`, Q14 never `pending`),
the gallery job limit (now 15 min), PRs appending to the same registry lines, one Team Focus gallery test that hung in CI twice and
never locally (now instrumented). A builder run is about 300k tokens; most of a screen PR is invented fixture data and its tests.
