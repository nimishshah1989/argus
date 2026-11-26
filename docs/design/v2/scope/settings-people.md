# Coverage: Settings → People, Logins (v2, `screens/v2/settings-people/`)

Built from v1 `screens/settings/People.tsx` and `people-specs.tsx` (deleted by S26-4, issue 791), e2e `settings-people.spec.ts`, wireframe `design/wireframes/S26-settings.html` (approved). Decisions: ADR 0047 item 4.

| Item                                                                                      | Source       | v2       | Where in v2                                                                                    |
| ----------------------------------------------------------------------------------------- | ------------ | -------- | ---------------------------------------------------------------------------------------------- |
| Admin only (anyone else is refused)                                                       | `People.tsx` | same     | `PeopleView`, `LoginsView` gate                                                                |
| People: name, short name, team, title, phone, cell, default shift, last sign-in, sign out | `peopleSpec` | same     | kit `CrudPage`; Name / Team / Title / Phone first, "No phone" tag                              |
| People \| Logins switch at the top of both pages                                          | `People.tsx` | replaced | two settings-menu entries (People, Logins), each one tap from settings home; no behaviour lost |
| People takeaway "5 of 47 have no phone"                                                   | wireframe    | new      | `peopleTakeaway`                                                                               |
| Logins: username, role, shared, person, cell, temporary password shown once               | `loginsSpec` | same     | kit `CrudPage`; Username / Role / Shared / Person first                                        |
| Logins takeaway "3 of 52 shared"                                                          | wireframe    | new      | `loginsTakeaway`                                                                               |

Notes (wireframe questions, block nothing; ADR 0044: built as drawn):

- Q4: the two counts come from the lists the pages already load; no new data.
