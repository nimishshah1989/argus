# Coverage: Settings → PM plans, Asset registers, Duty roster, Escalation ladder (v2, `screens/v2/settings-upkeep/`)

Built from v1 `screens/settings/pm-plans-spec.tsx`, `registers-spec.tsx`, `roster-spec.tsx`, `ladder-spec.tsx` (moved here by S26-3, issue 790), e2e `pm-plans.spec.ts`, `settings-registers.spec.ts`, `settings-roster.spec.ts`, `escalation-history.spec.ts:260`, wireframe `design/wireframes/S26-settings.html` (approved). Decisions: ADR 0047 item 3.

| Item                                                                      | Source                         | v2   | Where in v2                              |
| ------------------------------------------------------------------------- | ------------------------------ | ---- | ---------------------------------------- |
| PM plans list, add, edit, checklist, next due                             | `pmPlansSpec`, `pmPlanNextDue` | same | kit `CrudPage`                           |
| PM takeaway "1 of 3 overdue (8 days)"                                     | wireframe                      | new  | `pmTakeaway`                             |
| Asset registers (AMC, warranty, legal, calibration), remove with a reason | `registersSpec`                | same | kit `CrudPage`                           |
| Registers takeaway "TC-56 warranty ends in 6 days"                        | wireframe                      | new  | `registerTakeaway` (by `watchOf`)        |
| Duty roster lines, "Copy to the next 7 days"                              | `RosterScreen`                 | same | kit `CrudPage` + the copy action         |
| Roster takeaway "1 gap, C shift Sun 29-Nov"                               | wireframe                      | new  | `rosterGaps` (L1 per day × active shift) |
| Escalation ladder rules                                                   | `ladderSpec`                   | same | kit `CrudPage`                           |
| Ladder takeaway "High with no answer reaches L2 at 15 min, L3 at 45 min"  | wireframe                      | new  | `ladderSteps` (High = S1)                |

Notes (wireframe questions, block nothing; ADR 0044: built as drawn):

- Known v1 gap kept, not fixed: roster and ladder people lookups read the admin-only `/api/v1/people`, so a head sees ids, not names.
- The wireframe's "High" is severity S1, the most urgent; every active `ack_missed` rule applies to an S1 ticket.
