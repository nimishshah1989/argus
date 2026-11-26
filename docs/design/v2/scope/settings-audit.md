# Coverage: Settings → Audit trail (v2, `screens/v2/settings-audit/`)

Built from v1 `screens/settings/Audit.tsx` (deleted by S26-5, issue 792), e2e `settings-audit.spec.ts`, wireframe `design/wireframes/S26-settings.html` (approved). Decisions: ADR 0047 item 5.

| Item                                                                 | Source              | v2   | Where in v2                                                                                                                   |
| -------------------------------------------------------------------- | ------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------- |
| Admin and head read                                                  | `Audit.tsx`, server | same | settings gate (S26-1)                                                                                                         |
| Newest first, "Older changes" (cursor paging)                        | `Audit.tsx`         | same | kit table; "Older changes" button on the table's last page                                                                    |
| Area filter chips, search                                            | `Audit.tsx`         | same | Area, Person (admin only) as `SelectField`, From and To as `DateField` above the table (sent to the server); kit table search |
| When / What / Area / By; the reason (Why)                            | `Audit.tsx`         | same | default columns; the reason shows inline under What; expand shows old → new values                                            |
| Export CSV, admin only                                               | `Audit.tsx`         | same | `mayExport`                                                                                                                   |
| Takeaway "12 of 34 changes were on Analytics settings" (last 7 days) | wireframe           | new  | `auditTakeaway`; none while the window is only partly loaded                                                                  |

Notes (wireframe questions, block nothing; ADR 0044: built as drawn):

- Q5: the trail stays newest first.
