# Coverage: Settings → Company, Translations (v2, `screens/v2/settings-company/`)

Built from v1 `screens/settings/Company.tsx` and `Translations.tsx` (deleted by S26-7, issue 794), `company-spec.ts` and `translations-spec.ts` (moved here), e2e `settings-company.spec.ts`, `settings-translations.spec.ts`, wireframe `design/wireframes/S26-settings.html` (approved). Decisions: ADR 0047 item 7.

| Item                                                                                | Source                                       | v2   | Where in v2                       |
| ----------------------------------------------------------------------------------- | -------------------------------------------- | ---- | --------------------------------- |
| Company form: name, language, time zone, features, logo upload, Save and its states | `CompanyScreen`, `company-spec.ts`           | same | kit form; no takeaway (wireframe) |
| Translations: missing keys with their English, a Gujarati box each, search, Save    | `TranslationsScreen`, `translations-spec.ts` | same | kit table + form                  |
| Translations takeaway "212 of 1,480 keys (14%) have no Gujarati" + progress bar     | wireframe                                    | new  | `translationsTakeaway`            |

Notes (wireframe questions, block nothing; ADR 0044: built as drawn):

- Q3: Company stays a form with no takeaway.
