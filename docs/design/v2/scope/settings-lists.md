# Coverage: Settings → Lists, Glossary, Analytics profile (v2, `screens/v2/settings-lists/`)

Built from v1 `screens/settings/Lists.tsx` (deleted by S26-6, issue 793), `lists-specs.tsx` and `analytics-profile-spec.tsx` (moved here), e2e `settings-lists.spec.ts`, `analytics.spec.ts:273,445`, wireframe `design/wireframes/S26-settings.html` (approved). Decisions: ADR 0047 item 6.

| Item                                                                                                                                                                                     | Source                           | v2      | Where in v2                                                        |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | ------- | ------------------------------------------------------------------ |
| Six word lists (wait reasons, work types, quick problems, breakdown categories, lockout steps, failure codes): name, code, order, old codes; flags Pauses SLA, Vendor job, Needs lockout | `LIST_PAGES`, `listSpec`         | same    | each list (`?list=<page>`) is the kit `CrudPage`                   |
| Lists menu (one row per list with sub-line)                                                                                                                                              | `listMenu`, `ListsScreen`        | changed | hub tiles, one per list, linking `?list=<page>`                    |
| Every entry across the lists in one view                                                                                                                                                 | wireframe                        | new     | read-only "All" table, rows link to their list                     |
| Lists takeaway "Failure codes 39%"                                                                                                                                                       | wireframe                        | new     | `listsTakeaway`                                                    |
| Glossary: their word, our word, written in                                                                                                                                               | `glossarySpec`, `GlossaryScreen` | same    | kit `CrudPage`                                                     |
| Glossary takeaway "75% in Gujarati script"                                                                                                                                               | wireframe                        | new     | `glossaryTakeaway`                                                 |
| Analytics profile: every number in its four groups; money hidden from who may not read it                                                                                                | `analyticsProfileSpec`           | same    | kit form; Set / Not set tag and a progress bar added               |
| Profile takeaway "3 of 8 numbers not set"                                                                                                                                                | wireframe                        | new     | `profileTakeaway` (money keys the login cannot read never counted) |

Notes (wireframe questions, block nothing; ADR 0044: built as drawn):

- Q3: rules applied to the data pages only; the profile stays a form.
