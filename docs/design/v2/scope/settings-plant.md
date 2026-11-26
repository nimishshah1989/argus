# Coverage: Settings → Machines, Groups, Shifts (v2, `screens/v2/settings-plant/`)

Built from v1 `screens/settings/plant-specs.tsx` and `machine-production.tsx` (deleted by S26-2, issue 789), e2e `settings-plant.spec.ts` and `settings-production-data.spec.ts`, wireframe `design/wireframes/S26-settings.html` (approved). Decisions: ADR 0046 d5, ADR 0047 item 2.

| Item                                                                           | Source                   | v2      | Where in v2                                                                                                                                  |
| ------------------------------------------------------------------------------ | ------------------------ | ------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Machines list: code, type, segment, cell, criticality, status, production data | `machinesSpec`           | changed | kit `CrudPage`; Code / Type / Criticality / Status first, every other v1 column kept on the page (the wireframe's per-row fold is not built) |
| Add / edit / switch off a machine                                              | `machinesSpec`           | same    | kit form sheet                                                                                                                               |
| "Not counted in production data" switch                                        | `machine-production.tsx` | same    | same route; "Not counted" tag on the row                                                                                                     |
| Machines takeaway "9 of 126 have no criticality; 3 not counted"                | wireframe                | new     | `machinesTakeaway`                                                                                                                           |
| Segments and groups: code, name, order, shown on board                         | `groupsSpec`             | same    | kit `CrudPage`, Segment and group / Machines / Shown first                                                                                   |
| Groups takeaway (biggest group)                                                | wireframe                | new     | `groupsTakeaway`                                                                                                                             |
| Shifts: code, name, starts, ends, crosses midnight                             | `shiftsSpec`             | same    | kit `CrudPage` with Hours and a "Crosses midnight" tag                                                                                       |
| Shifts takeaway "3 × 8 h = 24 h against 16 production hours"                   | wireframe                | new     | `shiftsTakeaway`                                                                                                                             |
| Empty lines                                                                    | v1 specs                 | same    | kit empty state                                                                                                                              |

Notes (wireframe questions, block nothing; ADR 0044: built as drawn):

- Q2: shift hours (24) vs the profile's production hours (16): both numbers shown, nothing decided.
- Q4: counts the page did not show before (no criticality, not counted) are computed from the list the page already loads.
