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
- No user-visible change.
