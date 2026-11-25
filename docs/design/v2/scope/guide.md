# Coverage: Guide (`screens/v2/guide`), S25, ticket #762

Written 25-Nov-2026 by Plan from the approved wireframe `design/wireframes/S25-guide.html` (its Coverage section) and v1
`screens/analytics/GuidePage.tsx` + `guide-entries.ts` (36 entries, 4 not built), which the v2 screen reuses as its data.
Built as drawn; the wireframe's questions are notes below and do not block the ticket.

**MISSING (needs Nimish's written yes): none.** Every v1 item below is kept.

| Item                                                                         | Source                | v2     | Where in v2                                                                   |
| ---------------------------------------------------------------------------- | --------------------- | ------ | ----------------------------------------------------------------------------- |
| Title and intro line                                                         | `GuidePage.tsx`       | same   | page head                                                                     |
| Contents: all 36 headings as anchor links (`#guide-<id>`), two columns       | `GuidePage.tsx`       | better | kept; each heading carries its group chip; 8 group chips filter the list      |
| One section per entry: rule paragraphs, optional formula, "Open this figure" | `guide-entries.ts`    | same   | entry card per heading; link hrefs unchanged (`guideFigureLinks`)             |
| The 4 unbuilt entries print the "not in this build yet" line                 | `guide-entries.ts`    | better | line kept word for word, plus a "Not built yet" tag on the heading            |
| A takeaway over the contents                                                 | none in v1            | new    | "32 of 36 entries explain a live rule; 4 not built; biggest group" (computed) |
| Last item in the analytics rail; analytics access only                       | shell, `canAnalytics` | same   | `LIVE` entry, `FIRST.guide`                                                   |
| No loading, error or empty state (fixed text)                                | `GuidePage.tsx`       | same   | none needed                                                                   |
| Gujarati                                                                     | i18n keys             | same   | same keys; chip names added in en + gu                                        |

## Notes: open questions for Nimish (from the wireframe; built as drawn meanwhile)

1. Takeaways apply only to the Contents (the entries are fixed text). Is that enough? Built: Contents only.
2. The 8 groups (Basics, Overview, Reliability, Problems, Machines, People and money, Reports and data, Planning) are
   new: v1 had none. Keep them or the plain 36-line list? Built: the groups, as approved.
3. No Guide search box (v1 had none; the header search finds entries). Want one? Built: none.
