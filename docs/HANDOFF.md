# Where things stand — handoff for the next session (human or model)

**The one plan is `docs/plan/MILESTONES.md` (ticket 91 is the redesign); everything else is detail under it.** Read this, the tail of `docs/plan/ledger.md`, then `docs/slices/v2-build.md` (section 5) (queue, recipe, ready-to-paste briefs). `git log
origin/main` and the PR list beat this text. As of 16:00 UTC, 20 Nov 2026. **Second orchestrator session running.** Staging deploys on every merge (`https://cosmos.3-108-95-203.sslip.io/api/v1/health` shows the commit).

## In flight (orchestrator session 2, 16:00 UTC, 20 Nov): check each against GitHub first

- LIVE on staging (6 of 36 screens): Cell change log (#517), Machines register, Age, Footprint, Fix Finder, Problem Analysis (#523). Nimish merged both before independent review; the
  reviews (Opus) then found real bugs, fixed or in fix PRs: saved copy tied to a person (#525 merged), machine drawer link, ids on screen, wrong drills (#528 open).
- Open PRs; I merge only after an independent review passes AND its own checks are green (CI noise outside the diff is ignored, per Nimish):
  - #528 fixes from the review of #523 (review PASS): register and Age open their rows from one "See the machines" page action (no drill on a count it does not equal), old `?drill=` links, "Not computed
    yet", the engine printing machine codes not database ids in registers, footprint and Fix Finder, restored specs, the `analytics-order` gallery spec (RED ON MAIN until this lands). Needs main merged and a real CI run.
  - #526 Dashboard live on real data (draft): review fixes pushed (UUIDs, 30 s refresh, costliest change, held figures, query forms); blocked by Q16 until the shell PR lands AND Nimish answers the
    period-picker question.
  - #529 batch 5, four screens live (Energy, Shift-calendar KPIs, Bottleneck, Forecast Lab); the fifth, "Reliability scorecard", is NOT a v1 screen (the monthly scorecard is ticket 53, a new
    screen). CI running, independent review running. Its three rewritten real-server e2e specs have never run (no Docker locally).
  - `claude/v2-shell-parity` (builder running): the v2 shell lacks v1's Desk link and Ctrl+K search palette, and its rail links reload the page.
  - Merge order: #528, then #529, then #526 (all three change `screens/v2/live.tsx`; each later one merges main first).
- Next: an engine ticket, "no database id in any printed figure" (one test over every figure with machines re-keyed to UUIDs; known: Dashboard bubble ids, data checklist text, a2 category-cell,
  breakdown-log column 5, machine page byMachine, Bottleneck risk map, repeat faults); then Action Center and Machine page rebuilds; batch 4 and PM Calendar, Breakdown Log going live; Data Checklist,
  Compare, Team Focus rebuilds; batches 6 and 7.
- Rulings (Nimish, 20 Nov, session 2): do not spend time on CI noise that does not touch the diff (the `who-is-acting` /floor e2e and the `sla-timers` deadlock are unrelated flakes); only act on what blocks a merge or changes a result.
- Cost rules from Nimish: tests minimal, Sonnet builders, Opus reviewers. The repo setting "Allow auto-merge" is off; only he can tick it.
- Lessons (also in the builder contract used this session): the answer-key fixture sets machine id = code, so re-key to UUIDs in tests; a drill must equal its card; a figure v1 refreshed every 30 s must still refresh;
  never merge a stacked PR into its parent's branch; Nimish merges PRs himself while an orchestrator works, so fetch main before every dispatch; gallery specs run locally with the preinstalled Chromium
  (a throwaway Playwright config with `launchOptions.executablePath: '/opt/pw-browsers/chromium'`); the real-server e2e needs Docker and cannot run in this sandbox, so CI is the first run.

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
