# Coverage: Settings shell + Background jobs (v2, `screens/v2/settings/`)

Built from v1 `screens/settings/Plant.tsx` (`PlantSettings`, `Home`, `NoAccess`) and `Jobs.tsx` (`JobsScreen`), e2e `settings-plant.spec.ts` and `settings-jobs.spec.ts`, wireframe `design/wireframes/S26-settings.html` (approved). Ticket S26-1 (issue 788). Decisions: ADR 0044 d4, ADR 0046 d2–4, ADR 0047 item 1.

| Item                                                                  | Source                               | v2      | Where in v2                                                              |
| --------------------------------------------------------------------- | ------------------------------------ | ------- | ------------------------------------------------------------------------ |
| Admin and head only; everyone else "no access"                        | `PlantSettings`                      | same    | `settingsAccess` gate inside the kit shell                               |
| Desktop left menu: Desk (Open, Live board), then the plant pages      | `SideNav`                            | changed | kit `Shell` rail (Desk current) + `<nav aria-label="Settings">` of links |
| Phone list with sub-line and chevron, "Back to desk"                  | `Home`, `TopBar`                     | same    | phone home list                                                          |
| A page's "Settings" back link on the phone                            | `TopBar back`                        | same    | page header                                                              |
| Wide `/settings` opens Machines                                       | `Navigate`                           | same    | `SettingsView`                                                           |
| Background jobs entry only for who may see failed jobs                | `canSeeJobs`                         | same    | menu filter                                                              |
| Failed-jobs count on the menu ("n failed")                            | `FailedCount`, `jobs.menu.withCount` | same    | menu link label                                                          |
| Failed job rows: reason, attempts, failed at, Retry and its states    | `JobsScreen`                         | same    | kit rows (list items)                                                    |
| Jobs takeaway "1 job has failed: kind, n attempts, failed ago (when)" | wireframe                            | new     | `jobsTakeaway` above the rows                                            |
| People / Logins admin gate inside the page                            | `People.tsx`                         | same    | v1 body until S26-4                                                      |

Notes (wireframe questions, block nothing; ADR 0044: built as drawn):

- Q1: attention badges for other pages (overdue, gap, missing) and the menu takeaway are not built: v1 only badges Background jobs (ADR 0046 d4).
