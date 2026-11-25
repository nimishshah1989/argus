# 0045 — S27 Floor, S28 Desk, S29 Ticket, S30 Board onto the v2 kit: tickets, files and tests

Date: 2026-11-25 · Decided by: Plan (unattended; coordinator's planning job). Kit rules are ADR 0036 and are not
re-planned here. Nimish approved the four wireframes on 25 Nov (`design/approved.json`, carried by this plan PR).

## Decisions (assumptions, unattended)

1. **One ticket per screen, built in order S27, S28, S29, S30**; a screen splits in two only where one builder PR
   would be far over its budget (see "Tickets" below). Each PR makes the v2 screen live at v1's routes in `App.tsx`
   and deletes the v1 page and its now-dead helpers in the same PR (Nimish, 20 Nov). Routes kept: `/floor`,
   `/floor/other`, `/floor/mine`, `/floor/pm`, `/desk`, `/desk/mine`, `/desk/team`, `/desk/board`, `/desk/:id`.
2. **Files, the way interactive v2 screens are done (PM Calendar):** `apps/web/src/screens/v2/<screen>/` with
   `model.ts` (types + pure rules: role → views/actions, state → buttons), `adapter.ts` (API replies → model),
   `View.tsx` (draws the model, raises callbacks), `Page.tsx` (queries, mutations, offline queue: the live wiring),
   `register.ts` (screen key; `frozen` = the fixture for the gallery) and `fixture.ts`. Visible tests `view.test.ts`
   and `insight.test.ts` in that folder; hidden tests in `apps/web/src/screens/v2/holdout/<screen>-*.test.ts`.
3. **Pure v1 logic stays where it is and is imported by v2** (for example `faces/floor/machines.ts`,
   `report-state.ts`, `use-floor.ts`, `screens/desk/openLists.ts`, `views.ts`, `useTicketWindow.ts`,
   `screens/board/data.ts`). Exception: a pure function that lives inside a dead view file (`plantToday` in
   `TasksList.tsx`, `waitingFirst` in `TeamPanel.tsx`, `mayOpen` in `Shell.tsx`) moves to the v2 `model.ts`, and the
   seed points its existing test at the new place. Moving a module would delete its unit test on a build
   branch, which `loop-guard` rejects; the dashboard already imports `openLists.ts`. Only views and helpers that no
   live code imports after the switch are deleted.
4. **Tests a build branch may not touch are done on the seed by Plan.** `.github/loop/check_pr.py` fails a build PR
   that modifies or deletes an existing test. So each seed `plan/t<N>` already (a) deletes or retargets every v1 unit
   test whose subject file the ticket deletes, and (b) carries every e2e spec edit the new screen needs.
5. **e2e selectors are kept, so the specs keep passing unchanged.** Each scope file lists "Selectors the e2e specs
   rely on" (accessible names, labels, test ids, URLs). The v2 screen keeps those names; where the approved
   wireframe's words differ, the e2e-relied name wins and the wireframe word is used everywhere else. A builder who
   finds a spec that cannot pass without an edit stops and writes it under "Blocked" in its handoff; Plan edits the
   spec on the seed.
6. **Floor keeps exactly v1's floor behaviour:** the shared-phone acting person and Account sheet, Drafts, Send
   blocked while offline (v1's floor has no offline send queue, and lockout is a desk-only feature: neither is
   added), the per-phone Gujarati switch (ADR 0041; ADR 0036 R25 keeps it hidden by default; `floor.spec.ts:69`
   keeps the Gujarati line height 1.55, not the wireframe's 1.65).
   6b. **Phone parts are reused, not rebuilt.** `ui/v2` has no tab bar, wizard, sheet or form fields; the v2 floor and
   desk import the existing token-styled shared parts (`TabBar`, `WizardPage`, `Sheet`, inputs, `floor-pieces`,
   `components/TicketCard.tsx`, `components/SignoffFeed.tsx`) instead of adding a second phone kit (ADR 0036 rule 1:
   one kit). `pnpm ui:check` still applies to every new file. The floor and the TV board do not use `ui/v2/shell.tsx`
   (it draws an `h1`; the locked control-order specs `e2e/gallery/floor-order-lists.ts`,
   `board-settings-order.spec.ts`, `desk-order.spec.ts` start at `h2` and pin every heading, link and button).
   6c. **The locked control-order specs win over the wireframe.** Where the approved wireframe adds, drops or reorders a
   heading, link or button those specs pin (desk "Waiting" list kept on Team; "Day report" last on Mine; no new card
   buttons; floor REF kept on cards; "Cancel" on the not-fixed sheet; no TV "Today" heading), v1's order stays and the
   wireframe item is listed under "Unbuilt from the wireframe" in the scope file for Nimish's written yes.
7. **Coverage tables** are `docs/design/v2/scope/{floor,desk,ticket,board}.md`, written by Plan from the v1 code and
   its e2e specs before design. Any MISSING row is at the top and needs Nimish's written yes before that PR merges;
   the coordinator asks him. Each PR body carries the table as its `## Coverage` section.
8. **Builders run in dontAsk mode:** files written with Write/Edit only, one simple Bash command per call; no
   heredocs, no `>`/`>>` redirects, no `( )` subshells, no `{a,b}` brace expansion, no `$?`. A handoff's
   `## Blocked` section reads exactly `None.` when nothing is blocked.

## Tickets

Status: **split decided, no issues or seeds yet** (planning session hit its context budget after the inventories).
The next Plan session creates the six issues and seeds from this section and the scope files' seed facts below.

Six tickets, build order T1…T6. `size:large` each except T6 (`size:medium`). Budgets are warn-only (ADR 0038).

1. **S27-A Floor report flow** `/floor`, `/floor/other`: `screens/v2/floor/{model,adapter,View,Page,register,fixture}`;
   reuses `faces/floor/{machines,report-state,use-floor}.ts` (`useReport` as is). Deletes report, other-work,
   other-work-fields, machine-step, browse, machine-row, situation-step, problem-step, ticket-sheet (613 lines).
   Keeps `sent.tsx`, `floor-shell.tsx` (T2 uses them). No unit test to retarget. Budget files<=10 lines<=900.
2. **S27-B Floor lists** `/floor/mine`, `/floor/pm` (cards with REF as `listitem`, Cancel, sign-off ask/answered,
   dispute sheet, PM jobs). Deletes the remaining 9 floor views (568). Blocked by T1. Budget files<=8 lines<=700.
3. **S28-A Desk Open + two-pane** `/desk`, `/desk/:id` pane: `screens/v2/desk/` (model with `mayOpen`,
   `plantToday`; reuses `openLists.ts`, `views.ts`, `useTicketWindow.ts`, `components/TicketCard.tsx`,
   `SignoffFeed.tsx`); `TicketRoute.tsx` retargets its 2 imports; pane still embeds v1 `TicketDetail` until T5.
   Deletes desk `Board.tsx`, `TasksList.tsx`, `NeedsReport.tsx`, `TwoPane.tsx`. **Seed:** `desk/TasksList.test.ts`
   imports `plantToday` from `../v2/desk/model.js`. Budget files<=10 lines<=800.
4. **S28-B Desk Mine + Team** (day report download, Team "Waiting" kept, Closed sections, monthly minutes). Deletes
   `Desk.tsx`, `desk/Shell.tsx`, `MinePanel`, `TeamPanel`, `ClosedSection`, `parts.tsx`; 3 `useSystemTheme` imports
   → `ui/system-theme.js`. **Seed:** `desk/team-waiting.test.ts` imports `waitingFirst` from v2 model;
   `data/fetch-guard.test.ts:17` exception → `screens/v2/desk/Page.tsx`. Blocked by T3. Budget files<=12 lines<=800.
5. **S29 Ticket** `/desk/:id` (page and pane): `screens/v2/ticket/` rebuilds the read part (header, chips, facts,
   Minutes, people, history/timeline, sign-off state) from `ticketModel()`/`allowedActions()` (wrapping
   `actionSpecs.ts`, `lockout.ts`, `escalation-history.ts`); **re-hosts** the v1 action components unchanged
   (ActionBar, ActionForm, LockoutCard/Gate, AdminPanel, CloseFlow + close sheets, SignoffPanel, TaskPanel, PmClose,
   ReportControls) so the PR stays one ticket and does not wait for #760. Deletes `TicketDetail.tsx`,
   `TicketFacts`, `Figures`, `Timeline`, `ShareButton` if unused. v1 words pinned by specs stay ("Booked",
   "Stopped", "Minutes", "With report", "Write report and close", "Fill report"); a fact's note never sits in a `dd`
   after the value. Blocked by T3. Budget files<=10 lines<=1000.
6. **S30 Board** `/desk/board` (+ `?kiosk=1`): `screens/v2/board/`; model imports `screens/board/data.ts` (kept, its
   test untouched); deletes `Board.tsx`, `board/{Pulse,StopColumn,Scoreboard,DayScore}.tsx`, `board/scale.ts` (484).
   No on-screen refusal (v1 has none). No "Today" heading; "Longest" tag outside `data-testid="tile"`.
   Independent. Budget files<=8 lines<=550.

Every ticket: kit + reused shared parts, `pnpm ui:check`; keep every selector in its scope file's "Selectors the e2e
specs rely on"; PR body carries `## Coverage` from its scope file; wireframe-only items in "Unbuilt from the
wireframe" need Nimish's written yes before merge (coordinator asks). Visible tests `view.test.ts` +
`insight.test.ts` in the screen folder, hidden `screens/v2/holdout/<screen>-*.test.ts`.
