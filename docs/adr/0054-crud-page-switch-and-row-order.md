# ADR 0054: The kit CrudPage keeps a spec's switch, and its table sets the row order

Date: 26 Nov 2026 · Decided by: planner (unattended, PR #826 red CI; assumption recorded here)

PR #826 (ticket #789) put Machines, Segments and groups, and Shifts on the v2 kit `CrudPage`. CI failed on v1 behaviour the e2e specs lock (ADR 0050: lost behaviour is critical). Sorted by cause:

- **Kit gap.** v1's `crud-list` drew a spec's `toggle` ("Hide Floor line") as a real `role="switch"` with `aria-checked`, inverted for a hidden flag, in a 44 px tap target. The kit drew a plain button, so the state could not be read.
- **Kit look, specs follow.** The kit table shows ten rows a page (ADR 0036). The e2e plant has more than ten machines, so `Edit VC-5` and the production switches of VC-7 to VC-10 sat on a later page. The specs now type the machine's code in the table's search box first. Every assertion stands; the "1 machine not counted" chip still counts the whole plant.
- **Builder gaps**, written into issue #789: the page drew its own `h2` on top of the kit's (ADR 0052), and the rows lost v1's sub-lines ("VMC · Cell 1", "22:00 to 06:00 · crosses midnight").

## Decision

- `CrudPage` draws `spec.toggle` as a `role="switch"` (`.v2-switch`, 44 px target, on = accent) with `aria-checked` (inverted when the spec says so) and the spec's label. The default Switch off/on button is unchanged.
- `CrudPage` takes an optional `lead` (the page's takeaway), drawn right under its heading, so no screen draws a second heading to put a takeaway on top.
- Gallery control order for `/settings/machines` and `/settings/shifts` is re-read from the kit table: its sort headers, then in each row its column controls (the production switch) before the Edit and switch buttons in the last column. A list under 10 rows has no search box (ADR 0036 R13). No other control is added or dropped.

## Consequence

#791 to #795 get the switch for free. A row control that must come before Edit needs a kit change, not a screen workaround.
