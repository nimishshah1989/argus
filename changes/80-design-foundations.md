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
