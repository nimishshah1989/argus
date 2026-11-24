# ADR 0020 — Team Focus v2 goes live: what the engine and the saved notes fill, and what waits for a rule

Date: 2026-11-24 · Status: accepted (Plan, under ADR 0012 §3; Nimish away) · Tickets: #579 (TF-2), #580 (TF-3)

## Context

TF-1 (#573, ADR 0018) stores a status, an owner and a note per action under `focus:<period>|<action key>` and serves
them at `GET`/`PUT /api/v1/analytics/team-focus/notes`. The v2 Team Focus screen (S17) still runs on its fixture.
Its model was drawn for data we do not hold: a person's role and "load", a suggested owner, a rebalance proposal, a
"vs Oct" change and a 90-day strip per action. `scope/batch1.md` §4 already says none of these has a rule or a source.
The engine prints the month's actions and three counts; it does not print the month it plans, and the notes endpoint
needs it (`period`). The web's words are `todo | doing | done | skip`; the platform's stored words are
`open | prog | done | skip`.

## Decisions

1. **The engine publishes the month.** The `team-focus` figure value gains `period: 'YYYY-MM'` (its own
   `focusMonthOf(...).key`, the month after the last breakdown date). The web never derives it from `asOf` or from a
   lane-A key (the Dashboard banner's guess, which fails when lane A is empty). No `period` → the screen reads no notes
   and shows the engine's defaults; it never guesses a month to write into.
2. **Status words map one to one** at the web edge only: `open ↔ todo`, `prog ↔ doing`, `done ↔ done`,
   `skip ↔ skip`; any other stored word reads as `todo`. The stored words stay the platform's (ADR 0018). The label is
   v1's catalogue word (`analytics.teamFocus.status.<stored word>`).
3. **A saved note wins over the engine's default** for its action. A note whose action the figure no longer prints is
   not shown (ADR 0018 §6).
4. **Owner is the saved free text** (ADR 0018 §3). It prints as a person chip whose id is `owner:` plus the text and
   whose label is the text. The prefix tells it apart from a person id; TF-3's drawer answers it locally with that
   owner's actions. No person lookup: a plant names owners who have no login.
5. **People table = the owners the month's notes name**, each with open actions, open hours, closed actions; most open
   first, ties by name. `role` is empty and `load` is `null` (model type widened to `Load | null`): there is no rule
   for "overloaded" and we do not invent one. The load column and its two filters show nothing until a rule exists.
6. **No rebalance, no suggested owner, no strip, no money, no "vs last month".** `rebalance` is always `null`; a
   start decision's owner line says nobody owns it; `days` is `[]`; `money` is `''` (v1 showed no money here); KPI
   deltas are empty and carry no trend. Each is a `later:` line in `scope/team-focus.md` (TF-3).
7. **"Take it" = assign to me.** A start decision's action saves the signed-in person's shown name as owner (status
   unchanged); undo saves the owner empty. The status and note are edited in the action's drawer (TF-3).
8. **Lane words come back.** Each start decision's `why` is its lane's v1 hint (`analytics.teamFocus.hint.<lane>`);
   TF-3's action drawer prints the hint and the lane's "open of total".
9. **Split in two tickets.** TF-2 (#579): engine `period` + the pure adapter (figure + notes → model), not routed.
   TF-3 (#580, blocked by #579): the notes read in the provider, the writes, the drawer, the route, the coverage file
   and the v1 page's deletion.

## Consequences

- The Dashboard's Team Focus banner still counts every action as open (it reads no notes). Left for a later ticket;
  listed in `scope/team-focus.md` by TF-3.
- Batch1's four MISSING rows: lane hint (TF-2 adapter, TF-3 drawer), note (TF-2 model, TF-3 shows and edits it),
  per-lane open of total (TF-3 drawer), drill to the machines the actions name (TF-3, the page's drill control).
