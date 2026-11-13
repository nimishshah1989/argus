# 15 — Report a breakdown (floor)

Issue [#90](https://github.com/nimishshah1989/argus/issues/90) · M1 · Branch `claude/t15-report-breakdown`. PR body: `Refs #90` (the API-only part; ticket 15 stays open).

> **Status:** only decision 7 (the raise race) is built. Everything else is a draft for Nimish's frontend-design review; no screen is built until he approves it.

## Goal

An operator reports a stopped machine from the phone in v3's order: Step 1 of 3 machine, Step 2 of 3 situation, Step 3 of 3
problem, then the sent screen. Layout rule (MILESTONES M1): flows, screen order, button positions and copy stay v3's;
only the look (kit tokens, patterns) changes. Colour comes from the accent token only.

## Decisions

1. **Reuse, no new table or module.** The server already raises tickets (`POST /tickets`), upgrades (`upgrade-kind`), lists
   by machine and by reporter. The only server change is the raise race (below). No schema change.
2. **Wizard.** `WizardPage` carries the three steps. Two small optional additions to it, both needed by v3's Step 1 and 2
   (a tap on a machine or on "Machine has stopped" moves on; no "Next" button there): a step's `action` may be omitted, and
   its `body` may be a function that receives `next()`. Existing callers do not change.
3. **Other work** (v3 "Other work (not a machine)") is one screen with its own send, built on `PatternFrame`.
4. **My complaints** is a `QueuePage` on the `tickets` resource (`raisedBy`).
5. **Already reported.** A machine row with an open ticket reads "Already reported. Tap to view the ticket." and opens
   `/desk/:id`, except when that ticket is a `support` ticket: the row goes on to Step 2, where "Machine has stopped"
   upgrades the open ticket (`upgrade-kind`) and "Running, needs support" opens it. A send answered "already open"
   (409, also the race loser) looks the open ticket up by machine and does the same. The error body is unchanged.
6. **`?m=VC-17`** pre-selects the machine (same search normalisation) and starts at Step 2.
7. **Raise race.** The database's one-open-breakdown-per-machine index can still fire when the other report has not
   committed yet, or when an admin restores a cancelled ticket onto a machine that has a new open one. Both ended in a 500. `runOutcome` maps that violation to the existing 409 "Already reported" (after the same-key replay lookup).
8. **Strings.** New copy goes in its own catalogue namespace `report-floor` (`report-floor.en.ts` / `.gu.ts`), so ticket 16's
   desk keys cannot collide. `catalogue.test.ts` freezes the 05 key list; it learns the new namespace by name.
9. **Out of scope.** The Gujarati microphone (v3.reporting.11, M3); the pending-task warning (v3.reporting.05, not in the
   ticket); desk screens and `figures()` (ticket 16).

## Tests (behaviour a user sees)

- Server: simultaneous reports and restore-onto-open answer 409 `conflict`, not 500 (`tickets-raise-open.test.ts`, written first).
- Browser (`floor.spec.ts`, Pixel 5 / 360 px): search, group tile and recent machine each reach Step 2; a stopped report
  with a quick problem sends and shows its BD number; `?m=` opens Step 2 on that machine; a second report of an open machine
  opens that ticket; a stopped report on a support-ticket machine upgrades it; Other work sends and shows a WR number;
  "I am starting work on it now" starts the ticket; My complaints lists it and cancels an own un-started one.
- Unit: machine search ranking and group counts.
- Catalogue: every floor string is a key; `gu` has the same keys.

## Verify

`pnpm precheck`; e2e at 360 px with the v3 reference side by side (`docs/slices/15-v3-side-by-side.png`).
