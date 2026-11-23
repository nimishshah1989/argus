# ADR 0019 — The v2 Data Checklist goes live: drill, fix buttons, chips with nothing behind them

Date: 2026-11-24 · Status: accepted (Plan, under ADR 0012 §3; Nimish away)

## Context

DC-2 (#578) routes the v2 Data Checklist (S16) at v1's address, `/analytics/today/checklist`, on DC-1's live adapter
(#572, ADR 0017), and deletes v1's `DataChecklist.tsx` and `checklist-view.ts` in the same PR (CLAUDE.md screen rules).
A redesign never reduces scope, so everything v1 did must be on the v2 screen before v1 goes. Three things v1 had or
ADR 0017 promised are not in DC-1's model: v1's "See the rows" drill to the tickets behind the breakdown gaps, the
check cards' fix button ("Open the entries", "Open the machine records"), and a way to show a record that has no
machine (a log gap, an unregistered machine) without a chip that opens an empty drawer.

## Decision

**DC-2 carries all three; none becomes its own ticket.** Splitting them out would mean either keeping v1 alive past the
go-live PR or shipping a screen that does less than v1, which the screen rules forbid.

**Drill: one page control, not a card.** The engine names one ticket list for the whole figure (`drillIds`: the tickets
behind `bd_*` and `ww` items). No key figure counts exactly those tickets (Records to fix counts items, Breakdown log
also counts log gaps), and the rule in `drill-equals-figure.test.ts` is that a card opens exactly the rows it counts.
So the model gets `drill?: Drill` (`drillFor(reply, 'data-checklist', t)`, absent when the engine named no ticket), and
the view draws the kit's `DrillAction` under the verdict, as Age and Manpower do.

**Fix button.** By check: a machine-record check (`mc_*`) opens the machine register
(`/analytics/machines?screen=registers`); `log_gap` opens the Breakdown log (`/analytics/breakdowns?screen=breakdown-log`,
no ticket stands behind a missing day); a breakdown or Why-Why check opens the page's drill, or the Breakdown log when
the engine named no ticket. The engine sends one ticket list, not one per check, so a check's drill shows every gap's
tickets; a per-check list is later work in the engine. No Undo: nothing stores a fix (ADR 0017 (e)).

**Records with no machine print as text.** A record whose entity is a `decision` (a log gap's dates, an unregistered
machine's `—`) prints its label as plain text in the table, not an `EntityChip`, and its row opens nothing. The live
drawer returns nothing for a decision (`entity/live.ts`), so a chip would open an empty drawer.

**The approved look stays.** The wireframe (`design/wireframes/S16-data-checklist.html`) is not edited. The gallery runs
the approved fixture through the screen's `frozen` provider, and the fixture has no drill and no decision record, so the
gallery renders exactly as approved; a test holds the view's markup equal to the fixture's once the drill paragraph is
taken out. On live data the page shows one control the wireframe did not draw: the kit's standard page drill, the same
one every other live v2 page with a whole-figure drill shows.

**Rejected.** A drill on the Records to fix card (it would open fewer rows than it counts); a drill per check (the
engine has no per-check ticket list); keeping v1's page until a later ticket (two copies of one screen, against the
screen rules).

## Consequences

`scope/data-checklist.md` lists every batch1 §3 row as same, changed or better; none stays MISSING. The person chips for
a part's owner still name a role (`role:<role>`, ADR 0017 (a)); what their drawer shows is unchanged by this ADR. Nimish
can reverse the fix-button targets by editing `fixTarget` in `screens/v2/data-checklist/live.ts`.
