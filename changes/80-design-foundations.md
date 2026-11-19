# 80 — design foundations: the slice plan

- The plan for ticket 80 (`docs/slices/80-design-foundations.md`): what `PRODUCT.md` and the new `docs/DESIGN.md`
  must answer, which 8 of Emil Kowalski's 20 skills are installed and why, three visual directions (Instrument,
  Control Room, Ledger) with every colour role in light and dark checked for contrast on every background it is
  drawn on, and 19 small packets with the tracker row owned by the first.
- Records Nimish's 19 Nov answers: Running is grey, Waiting amber, Transferred blue; Indian number grouping;
  analytics follows the device theme and the TV stays dark.
- No user-visible change; no code.

## 80a — Emil Kowalski's design skills

- Builders get 8 of Emil Kowalski's 20 design skills (`prototype`, `emil-design-eng`, `apple-design`, `break-ui`,
  `mobile-native`, `animation-performance`, `review-animations`, `learn-taste`), copied unchanged with their MIT
  licence into `.claude/skills/`, and a source note in `.claude/vendor/emilkowalski-skills/`.
- `THIRD_PARTY.md` lists them with impeccable 4.8.1 and pstack 0.15.36; the tracker marks ticket 80 in progress.
- No user-visible change.

## 80b — PRODUCT.md

- Builders get `PRODUCT.md` at the repo root: every user (operator, technician, supervisor, head, plant head, admin,
  board), the device in their hand, where they stand and their job, with Nimish's 19 Nov answers (TV 50 inch or larger
  and always dark, Gujarati on the floor and English on the desk, Indian number grouping, analytics follows the device
  theme). Facts nobody has given yet say "not known yet".
- The impeccable and learn-taste skills now say where `PRODUCT.md` and `docs/DESIGN.md` live.
- No user-visible change.

## 80c — DESIGN.md sections 1 to 4

- Builders get the first four sections of `docs/DESIGN.md` in impeccable's shape: the overview with the two zones by
  route and Nimish's 19 Nov answers, the colour roles and the five-tone grammar with the one rule that maps all 40
  statuses, typography (UI sizes, TV sizes, Gujarati), and layout (breakpoints, the phone, laptop and TV tiers, the
  five templates, and how tickets 88 and 89 measure that the floor and desk keep v3 positions).
- It replaces the 22-line file and keeps what is still true: Apple's three principles, one accent, one primary
  action, the system font. Facts nobody has given yet say "not known yet". Sections 5 to 8 follow in 80d.
- A small test (`tools/design-doc.test.ts`) fails if a section goes missing or empties, or if a settled fact (Running
  grey, Waiting amber, Transferred blue, Indian grouping, analytics follows the device theme, the TV always dark and
  50 inch or larger) is dropped.

## 80h — the design preview's variant contract

- The design preview gets its shared contract in `apps/web/src/gallery/directions/variant.ts`. It holds the six
  fields each direction sets (tile shape, delta form, legend place, density, chart frame, chart height), the list of
  25 colour roles, 8 chart series and two 5-step ramps every direction defines in light and dark, its depth, corner
  and type values, a check that names what is wrong with a palette (including a series that equals a status
  colour), and one map that gives all 40 statuses a tone with
  Running grey, Waiting amber and Transferred blue.
- It also holds the Indian-grouping number formatter ("10,00,000"), which only the preview uses until tickets 83 and 86.
- Behaviour tests cover the status map and the formatter. No kit file, token or status file changes, so the 70 gallery
  baselines do not move.
- No user-visible change.

## 80i — the Instrument direction

- The design preview gets its first direction, Instrument, in `apps/web/src/gallery/directions/direction-instrument.ts`:
  raised cards, tint chips, a 192 px chart in a card, layered shadows, 10/14/20 corners, and every colour role in
  light and dark exactly as the plan's table sets them, with 8 chart series and two 5-step ramps per theme.
- A test checks it: light and dark set the same roles, every text pair is at least 4.5 to 1, every fill, chart series
  and border is at least 3 to 1 on the page and both surfaces, and no series sits in the red, green or info-blue bands.
- The palette check now also names a chart colour that is not a hex value or is used twice, and the Indian-grouping
  formatter prints a dash for a figure that is not a number and rounds to at most 3 decimals.
- No user-visible change.

## 80j — the Control Room direction

- The design preview gets its second direction, Control Room, in `apps/web/src/gallery/directions/direction-control-room.ts`:
  flat panels with a 3 px tone edge, the change shown in tone ink beside the value, a compact 160 px chart on the
  second surface, no shadows, 6/8/12 corners, figures set 0.02em tighter, and every colour role in light and dark
  exactly as the plan's table sets them, with 8 chart series and two 5-step ramps per theme.
- The same test that checks Instrument now runs for it, and every value passed as written, so no colour moved.
- The check that no chart series is grey now also catches a near-grey (channels that differ from each other by at
  most 8, on the 0-255 scale), not only an exact grey, because Running is the grey.
- No user-visible change.

## 80k — the Ledger direction

- The design preview gets its third direction, Ledger, in `apps/web/src/gallery/directions/direction-ledger.ts`:
  warm paper with no card, each figure in a ruled cell, the change written as a sentence under the value, a roomy
  one-tile-a-row phone layout, a 224 px chart between two rules with its key row below, figures and headings in a
  named system serif, flat with 1 px rules, and every colour role in light and dark exactly as the plan's table sets
  them, with 8 chart series and two 5-step ramps per theme.
- The same test that checks Instrument and Control Room now runs for it, and every value passed as written, so no
  colour moved.
- Where the plan is silent: the ruled tile has square corners (radius 0, it is a cell between rules, not a card), the
  other corners are 4 px as the plan says, and the serif figures keep normal letter spacing.
- No user-visible change.
