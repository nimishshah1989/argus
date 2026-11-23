# ADR 0017 — What the live Data Checklist prints where the engine has no figure

Date: 2026-11-24 · Status: accepted (Plan, under ADR 0012 §3; Nimish away)

## Context

DC-1 (ADR 0016) builds the v2 Data Checklist's live adapter from the engine's `data-checklist` figure: 16 groups,
value `{ counts, items: [{ group, key, plain }] }`, `plain` = `"<date> · <machine> — <what>"` (breakdown, Why-Why),
`"<machine> — <what>"` (machine records) or `"<date> to <date> — <what>"` (log gaps). The v2 model
(`apps/web/src/screens/v2/data-checklist/model.ts`) asks for five things the engine does not send. Each answer below
says what prints, why, and what replaces it later.

## Decision

**Shape.** One engine group = one check (`CheckData`). The parts of the data (`CheckGroup`) are v1's three sections
(`checklist-view.ts`): Breakdown log (`bd_*`, `log_gap`), Machines and utilities (`mc_*`), Analysis (`ww`), with v1's
labels. Parts are ordered most gaps first, ties in v1 order; checks inside a part gaps first, then the engine's order.
Every engine item is one record. The four KPIs are v1's four tiles: Records to fix (v1 "To do"), then the three section
counts. Check titles follow the platform's own titles in `fixtures/answer-key/data-checklist.json`. A group with no
items is a passing check, one sentence each. Words live in `packages/shared/src/i18n/analytics-v2-checklist.*.ts`.

**(a) Owner.** The engine holds no person per group. A part's owner prints a role as a person chip
(`{ kind: 'person', id: 'role:<role>' }`, label from `account.role.*`): Breakdown log → Supervisor (they close the
reports), Machines and utilities → Admin (they edit the machine register), Analysis → Head (they own Why-Why). Later: a
per-plant owner setting, when Team Focus (M2) stores owners.

**(b) Open age.** A breakdown or Why-Why record is open for the days between its date and the reply's `asOf`; a log gap
from its first missing day. Machine records and an unreadable date have no date: they print `—`, value −1, and sort
last. Later: the date a gap was first seen, once checklist runs are stored per item.

**(c) Change against last week.** No earlier checklist is kept. Every KPI has an empty delta (`text: ''`, which the kit
reads as "no earlier figure", `kpi-card.tsx` line 14), an empty period and no trend. Later: per-run counts in
`kpi_snapshot` (batch1 "Is data getting better").

**(d) Gap or check.** The platform rated `bd_obs` and `bd_em` "Low" (answer key page), and no figure on screen uses
Observed By, while Electrical / Mechanical feeds only the Compare score. Those two are checks; the other 14 are gaps,
each with the figure it changes ("Changes downtime and MTTR"). Later: the engine sends the figure map itself.

**(e) Fix and Undo.** Nothing stores a fix. Every check is `done: false` with empty `doneText`; its action is "Open the
entries" (breakdown log, analysis) or "Open the machine records". DC-2 wires that action to the figure's drill (the
tickets behind `bd_*` / `ww`, which the engine already names) and to the machine register; there is no Undo, and no
"Sent to" text. Later: a stored "data not available" mark, which the platform had (answer-key page text).

**Records.** A breakdown record's entity is its machine chip and its text keeps the date (`10-Nov-2026 · downtime hours
missing`), so v1's "names its date and machine" stays. A log gap has no machine; its entity is a `decision` chip
labelled with the date range. DC-2's view must print that chip as text, not open a drawer.

## Consequences

DC-1 changes batch1 coverage rows to built in the adapter: the three section counts, the 11 MISSING checks, each
breakdown item's date and machine, and "Not computed yet". DC-2 (go-live) owns the drill to tickets, the offline state
and deleting v1 `DataChecklist.tsx`. Owner roles, open ages, empty deltas and the gap split are Plan's calls; Nimish can
reverse any of them by editing the tables in `adapter.ts` and the catalogue.
