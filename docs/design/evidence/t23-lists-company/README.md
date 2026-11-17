# Ticket 23: lists, glossary and company settings, built

Screens taken from the e2e stack at 360 px (phone) and 1440 px (desktop) with the pseudonymised fixture tenant.
The lists and company screens are configuration, not hand-written forms (D5): `lists-specs.tsx` is one
`CrudSpec` per list and `company-spec.ts` is one field config; the screens read them.

| Image                         | What it shows                                                                       |
| ----------------------------- | ----------------------------------------------------------------------------------- |
| `settings-home-phone.png`     | The settings menu with Lists, Glossary and Company beside the others                |
| `lists-hub-phone.png`         | The lists hub: a row per configured list (wait reasons, work types, quick problems) |
| `wait-reasons-phone.png`      | Wait reasons: rows with their flags, the switch, and Add                            |
| `wait-reason-sheet-phone.png` | A wait reason in the sheet, with the Pauses SLA and Vendor job Yes/No choices       |
| `wait-reasons-desktop.png`    | The same list as a sortable table with the edit sheet from the right                |
| `work-types-phone.png`        | Work types: the same screen, its own flag (Needs lockout)                           |
| `glossary-phone.png`          | The glossary: their word, our word, written in                                      |
| `company-phone.png`           | Company: name, language, time zone, features and logo                               |
| `company-desktop.png`         | The same company screen at 1440 px                                                  |

## Deliberate differences from the locked design

- **The approved slice 4 frames are not in this checkout.** The ticket names `docs/design/slices/slice-4-*.html`;
  only slices 5 to 9 are HTML files, and slice 1 to 4 live as external canvas links in `docs/design/LOCK.md`.
  These screens were built against the LOCK settings row and the built Plant settings screens (#258): same
  `PatternFrame`, same sheet on the phone and right-hand panel from 1024 px, same tokens and type sizes.
- **Lists is a hub then one generated screen**, because the LOCK names "lists" as one settings row. The hub is
  built from `LIST_PAGES`, so a fourth list is a config entry, not screen code.
- **Flags are a Yes/No bar in the sheet**, not a switch: `FormSheet` is the one form control the kit has and the
  lock says a new control needs a new decision. The row's own switch stays the on/off one.
- **Company is one page, not a sheet.** It edits one company (its name, language, time zone and three switches),
  not one row of a list; the fields and sections still come from `COMPANY_FIELDS`, and every visible string is a
  catalogue key. The logo is a native file input with the kit's field border: the kit has no file control, and
  adding one to `ui/` is a design decision outside this ticket.
- **No dark or Gujarati screenshots.** Dark follows the system and A4/B6 frames are variants of the same screens;
  Gujarati strings are ticket 24 (the catalogue holds the keys with blank values).
