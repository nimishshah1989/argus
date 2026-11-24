# ADR 0039: Kit carve-out for the ADR 0036 kit tickets

Date: 25 Nov 2026 · Decided by: Nimish ("YES", 25 Nov 2026), precedent ADR 0028 §4 (#631)

## Decision

Builders may edit exactly these 13 kit files, and no other locked file under `apps/web/src/ui`, until every kit ticket #684–#704 is merged or closed:

| File (`apps/web/src/ui/v2/…`) | Ticket     |
| ----------------------------- | ---------- |
| `kpi-tone.css`                | #685       |
| `cards.css`                   | #686       |
| `action-strip.css` (new)      | #691       |
| `severity-row.css` (new)      | #692       |
| `ranked-bars.css` (new)       | #694       |
| `pareto.tsx`, `domain.css`    | #695       |
| `domain/heat-matrix.tsx`      | #696       |
| `quadrant.css` (new)          | #697       |
| `reason-chip.css` (new)       | #699       |
| `entity-chip.tsx`, `v2.css`   | #700, #704 |
| `verdict.tsx`                 | #704       |

How: `.loop.json` drops the two CSS globs (`apps/web/src/ui/**/*.css`, `apps/web/src/ui/*.css`; Python `fnmatch` lets `*` cross `/`, so either glob alone locked every ui stylesheet) and lists every other existing ui CSS file by name. `loop-guard` (`.github/loop/check_pr.py`) reads that list, so it accepts builder edits to these files. Checked with the guard's own `matches()`: the 13 files are open; every existing ui CSS file and every listed non-CSS kit file stays protected.

## Known gaps while this is open

1. **The ADR 0028 §4 carve-out was never closed.** #620 merged, but `apps/web/src/ui/**` was not restored, so non-CSS kit files that are not listed (new files, plus `data-table.tsx`, `paged-table.tsx`, `kpi-card.tsx`, `figure-tile.tsx`, `status.ts`, `table-model.ts`, `table-parts.tsx`, `domain/engine-table.tsx`, `domain/printed-table.tsx`) are open. Every kit ticket except #701 and #703 depends on that gap: each adds or edits an unlisted `.ts`/`.tsx` kit file (for example `format.ts`, `kpi-card.tsx`, `ranked-bars.tsx`, `figure-tile.tsx`). Restoring it now would block them, so both carve-outs close together.
2. With the CSS globs gone, a **new** CSS file anywhere under `apps/web/src/ui` is open too. The reviewer checks that a kit PR adds only the stylesheet its ticket names.

## End condition

When #684–#704 are all merged or closed, Plan restores the single glob `apps/web/src/ui/**` in `.loop.json` (in place of the enumerated ui entries) and drops `_kit_carve_out`. That one change closes this carve-out and ADR 0028 §4.

## Why

The kit tickets in ADR 0036 must change shared kit stylesheets and four kit components; with the files locked, builders burned attempts on guard refusals (`b-685.log`, `b-686.log`). Naming files keeps the rest of the kit under CI guard.
