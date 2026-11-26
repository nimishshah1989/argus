# Coverage: Desk settings (v2, `screens/v2/desk-settings/`, `/desk/settings`)

Built from v1 `screens/Settings.tsx`, `components/SettingsSections.tsx` and `components/SlaSettingsSections.tsx` (deleted by S26-8, issue 795), e2e `settings-severity.spec.ts`, `sla-timers.spec.ts`, `coded-close.spec.ts:50`, wireframe `design/wireframes/S26-settings.html` (approved). Decisions: ADR 0047 item 8.

| Item                                                                                                     | Source                                       | v2      | Where in v2                                                 |
| -------------------------------------------------------------------------------------------------------- | -------------------------------------------- | ------- | ----------------------------------------------------------- |
| Machine criticality, per machine, save                                                                   | `CriticalitySection`                         | same    | kit table with a select per machine                         |
| Criticality takeaway "9 machines without criticality"                                                    | wireframe                                    | new     | `criticalityTakeaway`                                       |
| Severity matrix: criticality × Machine stopped / Support, Work request, Urgent work request; Save matrix | `MatrixSection`                              | same    | kit grid; High (S1) cells get the loss tone tag             |
| Matrix takeaway "one High cell"                                                                          | wireframe                                    | new     | `highCells`                                                 |
| SLA policies: acknowledge and restore minutes, pause limit, handback, business hours only; Save          | `SlaSettingsSections`                        | same    | kit table with bars, S1 first                               |
| SLA takeaway "High SLA 15 min and 4 h"                                                                   | wireframe                                    | new     | `slaRows` (first row)                                       |
| Restore clock pauses (per wait reason)                                                                   | wireframe; `pausesSla` edited in Lists today | changed | read-only list + link to `/settings/lists?list=wait_reason` |
| Pauses takeaway "3 of 9 wait reasons pause"                                                              | wireframe                                    | new     | `pausingReasons`                                            |
| States: loading, forbidden + SLA note, load failed, offline read-only, saved, save failed                | `Settings.tsx`                               | same    | unchanged                                                   |

Notes (wireframe questions, block nothing; ADR 0044: built as drawn):

- Question for Nimish: Restore clock pauses are read-only here, with a link to the wait-reasons list, so the flag keeps one write path. Say if it should be editable on this page too.
- "High" is severity S1, the most urgent.
