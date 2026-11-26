# ADR 0052: The kit CrudPage heads its own page

Date: 26 Nov 2026 · Decided by: planner (unattended, PR #824 red CI; assumption recorded here)

PR #824 (ticket #790) put PM plans, registers, roster and ladder on the v2 kit `CrudPage`. Its title lived only inside the `DataTable` card, so an empty list drew `EmptyState` and no heading: `/settings/registers` failed its e2e heading check and the roster lost `h2: Duty roster` in the gallery's control order. The title also came after the Add button, where v1 put it before (gallery rule: a restyle never moves a control or heading).

## Decision

- `CrudPage` draws `<h2 class="v2-h2">` with its spec's title first, before the intro and the Add button, whatever the list holds (as v1's `PatternFrame` did).
- Its `DataTable` gets `headed`: the section keeps the title as its `aria-label` and draws no second heading. `TableBar` skips the title when it is empty.
- The small-table rule (ADR 0036 R13: under 10 rows, no search, no pager) stands. `pm-plans.spec.ts` opens the plan by its row's Edit button; the e2e plant has under 10 plans. No assertion is weakened.

## Consequence

Every later Settings ticket on the kit `CrudPage` (#789, #791–#795) gets the heading for free and must not add its own.
