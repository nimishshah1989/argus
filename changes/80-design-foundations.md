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

## 80g — the design preview figures

- The design preview will print the plant's real figure shapes, so a new script (`tools/directions-figures.ts`) runs the engine on the 11 November answer key and saves the dashboard, one machine (VC-28), the breakdown log and the four breakdown analyses as one small file (about 100 KB, every table cut to 50 rows, no drill ids).
- `pnpm tsx tools/directions-figures.ts --check` fails when that file is missing or out of date.
- No user-visible change.
