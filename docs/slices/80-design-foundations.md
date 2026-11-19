# F-80 — Design foundations (ticket 80)

Ticket 80 (`docs/plan/MILESTONES.md:696-701`): the design file everything in F is built from, with no change to
what any user sees. Goals: (1) `PRODUCT.md` and a new `docs/DESIGN.md` that defines 100 % of the roles 81–89 use;
(2) D04, D27, `docs/design/LOCK.md` and the `CLAUDE.md` mockup line amended under D33 (one approved mockup per
template, with Nimish's go), Emil Kowalski's skills installed with their licence; (3) three directions of Today, a
machine page and Breakdowns at 360 and 1440 px behind the `prototype` picker, and Nimish picks one. Ticket 73's goals
are merged (#408–#410), so 80 is unblocked. Authority: D33, D04, D20, D27, D09, LEAN, LOCK rule 1. Every fork is a
numbered ruling (R1–R16) with its cost.

**Revision 3 (19 Nov, second review).** Contrast is checked on every background a direction draws on; fills carry
no text; the real floor step keeps today's green Running until 82; 80s no longer deletes anything; 80a goes first
and alone and owns the tracker row; at most three builders at once.

## Settled by Nimish (19 Nov, product)

| #   | Question                | Answer                                                                                                                                                           |
| --- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| N1  | Running                 | Grey (neutral). Stopped, waiting and transferred stand out; running is quiet. Green stays for fixed, confirmed and target met                                    |
| N2  | Waiting and Transferred | Waiting is amber (attention), Transferred is blue (info), each keeping its icon and word. The old orange and violet are retired on the floor, desk and analytics |
| N3  | Numbers                 | Indian grouping (1,00,000). Money keeps the form it already prints, "₹ 38.23 lakh" (`apps/web/src/screens/analytics/figures-43.test.ts:194`)                     |
| N4  | Theme                   | Analytics follows the device's light or dark setting; the TV board is always dark (both already in `useSystemTheme`, `screens/desk/Shell.tsx:52-58`)             |
| N5  | Shared phones           | Settled by `docs/design/LOCK.md:97`; `PRODUCT.md` needs one confirmation from Nimish only: the TV's size                                                         |

## A. Facts (verified in this checkout, 19 Nov; "inferred" is marked)

| Fact                 | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tokens               | `apps/web/src/ui/tokens.css` (173 lines): 72 light names (66 `@theme`, 6 `:root`), 40 dark overrides. Colour 44 (accent 5, surface 1, control 1, neutral 10, tone 7, ink 7, tint 7, old alias 6), chart 4, text 12, leading 1, font 1, radius 4, shadow 2, spacing 2 (52/44 targets), motion 2. No third depth level, no third chart colour, no ramps, no dark chart values                                                                                  |
| Type                 | Six UI sizes 12/14/16/20/24/32 and six TV sizes 40–160 (`screens/board/scale.ts`, `screens/Board.tsx`); weights 400/600/700/800 (`LOCK.md:28-30`); system stack with Noto Sans Gujarati (`tokens.css:2-3`)                                                                                                                                                                                                                                                   |
| Meaning              | 40 statuses in 10 groups (`ui/status/*.ts`: ticket 8, floor 3, report 2, severity 4, clock 5, handback 4, pm 3, forecast 3, sync 4, task 4) on 7 tones (danger 8, muted 8, hold 6, ok 6, warning 6, info 5, moved 1). `ticket.running` is `ok` (`ui/status/ticket.ts:19`) and every machine with no open ticket reads `running` (`faces/floor/machines.ts:78`)                                                                                               |
| Icons                | 63 Lucide icons exported from `ui/icon.ts`; `tools/check-ui.ts` fails Lucide anywhere else                                                                                                                                                                                                                                                                                                                                                                   |
| The chart door today | `ui/chart/use-chart.ts` 394/400 lines. Bar ≤ 2 series (`:34`) with value labels; line with end labels, series 2 dashed with triangles (`:225-230`); scatter, the only tooltip (`:265`); mixed, stacked bars + dashed line (the Pareto, `:304-330`). Palette: 2 series, axis, grid, font, 7 tones (`:84-91`), read once at first draw (`:369`). No Legend or Heatmap module. The kit `Chart` fixes height 192 px (`chart.tsx:47`, `h-48`) and its own caption |
| Kit colour classes   | `ui/`, `patterns/`, `faces/` use `text-neutral-600` 46×, `text-neutral-900` 23×, `border-neutral-200` 11×, `bg-neutral-200` 7×, `text-neutral-700` 4×, `border-neutral-500`, `bg-neutral-900`, `bg-neutral-300`, `bg-neutral-100` once each                                                                                                                                                                                                                  |
| Gallery              | `/gallery` in dev or with `VITE_GALLERY=on` (`App.tsx:26-30`); 15 sections plus `?view=desktop` (`Gallery.tsx:118`); 70 baselines, regenerated only in the pinned image (`pnpm gallery:update:docker`); CI's gallery job uses the same image (`ci.yml:174-205`)                                                                                                                                                                                              |
| `check-ui`, cards    | `check-ui` polices `faces/` only (no `className`, `style`, raw colour, > 120 lines) and Lucide everywhere. `shadow-card` appears 57× in 46 files under `screens/` + `components/`                                                                                                                                                                                                                                                                            |
| Number formats       | Figures print with `en-GB` (`screens/analytics/figure-content.ts:148-152`, `FigureTile.tsx:22`); no Today figure reaches 1,00,000                                                                                                                                                                                                                                                                                                                            |
| Engine on the key    | `run(ENGINE_DATA, '2026-11-11', DEFAULT_PROFILE)`: 51 figures, 48 ready, 26 screens, 1.14 MB in 3.1 s (measured); the fixture reads files with `node:fs` (`packages/domain/test/answer-key/keys.ts:11`)                                                                                                                                                                                                                                                      |
| Dev server, Docker   | `vite --port 3100` serves `/gallery` with no API and repo files via `/@fs` (verified). Docker has no daemon (verified); screenshots are judged only in CI                                                                                                                                                                                                                                                                                                    |
| impeccable           | 4.8.1 pinned without `scripts/` (`.claude/skills/impeccable/SKILL.md:10`): it reads `docs/DESIGN.md` and `PRODUCT.md`; `init` writes `PRODUCT.md` at the root; `document` wants front matter and eight sections in order                                                                                                                                                                                                                                     |
| Checks               | `docs:check` reads 5 instruction files, `.claude/agents/*.md`, 3 stack files and the tracker (a `feat(80…)` commit fails while row 80 says `todo`); never `.claude/skills/` or `.claude/vendor/`. `pr-size` skips `docs/`, `.md`, `fixtures/`, `generated/` (`tools/check-pr-size.ts:7`). `licences` reads production npm packages only                                                                                                                      |
| Bhavin's v3          | `docs/discovery/bhavin-v3/maint.html` reads its client from `clients/index.json` (absent here) and calls his live API (`:4`, `:399`); config is kept in `bd_cfg_<id>` and chosen with `?c=` (`:404`, `:2388`)                                                                                                                                                                                                                                                |

**R1 — where the files live.** `PRODUCT.md` at the root (where `init` writes); DESIGN.md stays `docs/DESIGN.md`
(CLAUDE.md, AGENTS.md, D04, D33 and the pin note name it). 80b adds one line to the impeccable pin note and one to
learn-taste naming both paths. No `.impeccable/design.json`. _Cost:_ one move.

## B. What the new `docs/DESIGN.md` must answer

Impeccable's front matter (`colors`, `typography`, `rounded`, `spacing`, `components`, keyed by the role names
below) and its eight sections in order; product rules are subsections. `ui/tokens.css` keeps the values; 81 adds a
test that the two agree. 80c writes §1–4, 80d §5–8, 80s the winner's values.

1. **Overview.** North star. The two zones by route: `/floor/*`, `/desk/*` (board, TV, ticket) and settings keep v3
   flow, order, button position and words; `/analytics/*` is free. Operate mode. The bar: critique ≥ 32/40, 0 P0,
   axe 0, 360 px first.
2. **Colors.** Neutral roles (page, surface, surface-2, line, control, ink, ink-2, focus = accent); accent (fill,
   on-fill, text, tint). **Tone grammar:** critical, attention, good, info, neutral, each ink/tint/fill. A chip is
   tint + ink + icon + word; **a fill never carries text** (bars, heat cells, a 3 px edge, a dot); one critical fill
   per card. **The 40-status map (one rule):** danger → critical; warning and hold → attention; info and moved →
   info; ok → good except `ticket.running` → neutral; muted → neutral. **Contrast rule:** every text 4.5 and every
   mark or border 3.0 against every background it is drawn on (page, surface, surface-2, its tint). **Direction of
   good** per figure. **Chart colours:** 8 categorical per direction, never a status value and never in the red
   (345–50°), green (90–160°) or info-blue (205–235°) bands; one sequential and one diverging ramp; ramp cells carry
   computed black or white labels at 4.5.
3. **Typography.** Families per the pick; Gujarati falls back to the OS face in every direction (Noto Sans Gujarati
   on Android and in the CI image; Nirmala UI on Windows and Gujarati Sangam MN on macOS, _inferred_); 1.55 leading;
   the six UI and six TV sizes plus the analytics tile value (28, 32 or 40 per the pick); tabular figures; a
   40-character Gujarati label wraps to two lines, then ellipsis with the full text on focus.
4. **Layout.** Breakpoints 360/768/1024/1440, TV 1920. **Density tiers:** phone (one column, 2 tiles a row, 16
   gutter, 44/52 targets, 10 rows before "more"), laptop (12 columns, 4–6 tiles, 36 px rows for a pointer only, 50
   rows a page), TV (read at 3 m, no pointer, no money, always dark). The five templates by region and tier; grouped
   navigation; drill trail; period picker. **Two-zone rule:** the floor and desk may change colour, type, depth and
   motion, never order, position or words. **How 89 measures "same third":** at 360 × 740, for each control in a
   v3↔ours mapping table, DOM order index and `floor(centreY / (740 / 3))` must be equal. **Capturing v3:**
   Playwright opens `maint.html` from disk with every network request blocked, a planted fictional client
   (`localStorage['bd_cfg_demo']` holding invented plant, machines and people, opened with `?c=demo`), and saves
   one PNG and one JSON of control boxes per step to `docs/design/evidence/bhavin-v3/`; every name on screen is
   invented, so no real personal data is captured.
5. **Elevation & Depth.** Level 0 page, 1 raised, 2 overlay, in light and dark; no level 1 inside level 1; TV uses
   0 and 1 only.
6. **Shapes.** Radius per role (control, card, sheet, chip, tile); border versus shadow; table rules; focus ring.
7. **Components.** The 13 elements of 83 with anatomy, states, tones and tier sizes; the KPI tile in full; **empty,
   loading and error** for every element and template (what shows, the words' source, retry, the offline line, as
   `viewState` and `StateNotice` split them, `patterns/view-state.ts`). **Charts:** a tile for one current value; a
   trend for ≥ 6 periods; a bar for ≤ 12 categories; a ranked list or Pareto for more; a heatmap for two
   dimensions; the table always, behind Show the numbers; a legend at ≥ 2 series (a line's end labels count as its
   legend); tooltip and tap on a phone; bars from zero. **Icons:** Lucide via `ui/icon.ts`, 16/20/24, stroke 2.
   **Motion:** 150/250 ms ease-out for sheet, chip, tab indicator, skeleton; figures and floor rows never move; 0
   under reduced motion. **Numbers:** `en-IN` grouping (N3), money "₹ … lakh", `%` on every percentage, units, "—".
8. **Do's and Don'ts.** The floor/desk prohibitions first; later corrections added by `learn-taste`, dated.

## C. Emil Kowalski's skills (`/home/user/emilkowalski/skills`, MIT, commit `64eb3de`, 20 skills)

| Skill                                                                                    | Verdict | Ticket         | Reason                                                                      |
| ---------------------------------------------------------------------------------------- | ------- | -------------- | --------------------------------------------------------------------------- |
| `prototype` (+ `PICKER.md`)                                                              | use     | 80 (85)        | The picker for the three directions; PICKER is copied verbatim              |
| `emil-design-eng`                                                                        | use     | 83, 85, 87, 88 | Press, focus and popover craft for the kit                                  |
| `apple-design`                                                                           | use     | 80, 83         | Depth and type sections of DESIGN.md; its springs and gestures are not used |
| `break-ui` (+ `CATALOG.md`)                                                              | use     | 83, 86, 87     | 83's goal 2: long Gujarati label, 7-digit number, 0 items                   |
| `mobile-native`                                                                          | use     | 89 (83)        | 89's goal 2 checklist                                                       |
| `animation-performance`                                                                  | use     | 84, 89         | Chart and sheet motion on a low-end Android                                 |
| `review-animations` (+ `STANDARDS.md`)                                                   | use     | 83, 85         | The motion review before a template is approved                             |
| `learn-taste`                                                                            | use     | 80 onward      | Writes Nimish's corrections into `docs/DESIGN.md`                           |
| `animate`                                                                                | not now | —              | Two durations and four moving things; §7 covers them                        |
| `improve-animations`, `find-animation-opportunities`, `choreograph`, `remove-animations` | no      | —              | Almost no motion exists; Operate screens gain nothing from more             |
| `animation-vocabulary`, `gestures`                                                       | no      | —              | A glossary; v3's taps stay and the one sheet is Radix                       |
| `pick-ui-library`                                                                        | no      | —              | Its picks (recharts, motion, base-ui, clsx, cva) contradict D20, D27, LEAN  |
| `ask-emil`, `ask-sonner`, `animate-expo`, `write-swift`                                  | no      | —              | A router to skills not installed; Sonner, React Native, Swift not used      |

**R2 — install.** The 8 "use" skills verbatim into `.claude/skills/<name>/` (no collision with the 67 present), each
with the upstream `LICENSE`; `.claude/vendor/emilkowalski-skills/{LICENSE,NOTICE.md}` (source, commit, the 8 copied,
the 12 left out, and the one local line 80b adds to learn-taste). `THIRD_PARTY.md` "Tools" gains Emil Kowalski
skills (8 of 20, MIT), impeccable 4.8.1 (Apache-2.0) and pstack 0.15.36 (MIT). `prototype`, `learn-taste` and
`review-animations` are `disable-model-invocation: true`: builders `Read` them; only Nimish types `/prototype`.
**What proves the licence:** the `THIRD_PARTY.md` row plus a `LICENSE` file in each of the 8 folders and the vendor
folder (`pnpm licences` reads npm packages only and cannot see skills). **Install test** (run here, then removed):
with the 8 copied and staged, `docs:check` and `pii:scan` reported 0 problems (2169 files); a grep of all 20 for the
process markers, Drizzle and phone-shaped numbers found nothing.

## D. Three directions

All three obey D33 and N1–N4, render the same figures, and differ on two layers. **Tokens:** every role below, set
by the harness as inline custom properties on `<html>` (R7). **Variant map:** a fixed object each direction
exports, read by the prototype's own `parts-*.tsx`:

| Variant field | Instrument                                                                                                                      | Control Room                                                    | Ledger                                                                                                             |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Idea          | Refined light, layered depth; finishes today's world                                                                            | Dense; signals stand out of a graphite ground; TV-ready         | Warm paper, ruled lines, figures set like a printed report                                                         |
| `tile`        | `card`: raised card, label above, value 32/700                                                                                  | `edge`: flat panel, 3 px tone edge, value 28/600, 2 rows        | `ruled`: no card, ruled cell in a grid, value 40 serif                                                             |
| `delta`       | `chip`: tint chip, arrow icon, "12 %"                                                                                           | `inline`: arrow and "12 %" in tone ink beside the value         | `words`: "12 % more than October" under the value                                                                  |
| `legend`      | `above` the chart, as chips                                                                                                     | `inline` with the chart title                                   | `below`, as a key row (lines also keep their end labels)                                                           |
| `density`     | comfortable: 2 tiles a row phone, 4 laptop                                                                                      | compact: 2 phone, 6 laptop; 36 px rows with a pointer           | roomy: 1 tile a row phone, 3 laptop                                                                                |
| `chartFrame`  | inside a level-1 card on surface, 192 px                                                                                        | on surface-2, 160 px                                            | between two rules on page, 224 px                                                                                  |
| Type          | system stack                                                                                                                    | system stack, figures −0.02em                                   | system sans; figures and headings `Georgia, Cambria, 'Times New Roman', 'Noto Serif', 'Noto Sans Gujarati', serif` |
| Depth, radius | L1 `0 1px 2px rgb(16 24 40/.06), 0 4px 12px rgb(16 24 40/.06)`, L2 `0 12px 32px rgb(16 24 40/.18)`; radius 10/14/20, chip round | no shadow, surface steps and a 1 px line; radius 6/8/12, chip 4 | flat, 1 px rules, L2 only `0 16px 40px rgb(28 25 23/.2)`; radius 4                                                 |

**Charts** draw only what the door draws today: the same bar, line, scatter and mixed charts with the direction's
series 1–2, axis (ink-2) and grid (line). `parts-chart.tsx` calls `useChart` directly so it can set the variant's
height, title row and legend place, and prints its own Show the numbers table from the spec (prototype only, gone
in 81); no packet changes `use-chart.ts` or `chart.tsx` (that is 84). Series 3–8 and the ramps appear only in HTML
(ranked bars, legend chips, the heat grid, a palette strip). **R3 — no webfont:** Ledger's serif is a named system
stack (Georgia/Cambria on Windows and macOS, Noto Serif on Android, _inferred_), so no ADR and no dependency.

**Every role, light and dark** (`page / surface / surface-2 / line / control / ink / ink-2 / accent / on-accent /
accent-tint`; then each tone `ink / tint / fill`). Three values were moved by the round-3 check: Instrument light
control `#8a9099 → #878d97`, Control Room light attention fill `#d97706 → #cf7206`, good fill `#16a34a → #159f48`.

| Direction    | Theme | Neutrals and accent                                                               | critical                  | attention (Waiting)       | good                      | info (Transferred)        | neutral (Running)         |
| ------------ | ----- | --------------------------------------------------------------------------------- | ------------------------- | ------------------------- | ------------------------- | ------------------------- | ------------------------- |
| Instrument   | light | `#f4f5f7 #ffffff #f8f9fb #e3e5e8 #878d97 #15171a #5b616b #0f766e #ffffff #e3f2f0` | `#b42318 #fdecea #d92d20` | `#93370d #fef4e6 #dc6803` | `#05603a #e7f6ec #079455` | `#1d4ed8 #e8effd #2e6be6` | `#475467 #eef0f3 #667085` |
| Instrument   | dark  | `#0e1013 #171a1f #1e2228 #2b3038 #6f7785 #f2f4f7 #a3abb7 #2dd4bf #04201d #12302c` | `#f97066 #3b1714 #f04438` | `#fdb022 #3a2709 #f79009` | `#47cd89 #0f2e1f #17b26a` | `#84adff #172440 #528bff` | `#a3abb7 #262a31 #7d8694` |
| Control Room | light | `#eef1f5 #ffffff #f6f8fa #dfe4ea #7c8796 #0b1220 #4a5568 #0e7490 #ffffff #e0f2f7` | `#b91c1c #fdeaea #dc2626` | `#92400e #fdf1dc #cf7206` | `#166534 #e5f5ea #159f48` | `#1d4ed8 #e7eefd #2563eb` | `#4a5568 #e9edf2 #64748b` |
| Control Room | dark  | `#0b0f14 #121821 #19212c #2a3544 #5f6e82 #e6edf5 #9aa7b8 #22d3ee #04141a #0b2a33` | `#ff7a7a #3a1418 #ff5c5c` | `#ffb84d #3a2808 #ffa41b` | `#4ade80 #0e2e1c #22c55e` | `#7cb8ff #11233d #3b9bff` | `#9aa7b8 #1f2733 #6b7a8f` |
| Ledger       | light | `#f6f3ee #fffdf9 #faf7f2 #ddd5c8 #8a8178 #1c1917 #57534e #3538cd #ffffff #ecebfb` | `#b42318 #fbe9e7 #c8321f` | `#8a4b08 #faf0dc #c27803` | `#2f6b2f #e9f2e3 #3f8f3f` | `#1e4f91 #e6eef8 #2f6fc0` | `#57534e #efeae2 #78716c` |
| Ledger       | dark  | `#171512 #201d19 #28241f #3a342c #7a7166 #f4efe7 #b5ab9c #a4a7ff #14123a #25244a` | `#ff8a7a #3d1a15 #f0604d` | `#f5b74a #3a2a0e #e39b1a` | `#8fd18f #1b2e1b #5fb35f` | `#8fb8f0 #16263a #5c93dc` | `#b5ab9c #2c2822 #8a8278` |

**Series, ramps and the worst case per pair** — output of the planning script (WCAG 2.x; every colour checked
against page, surface and surface-2 of its theme, inks also against their tint; series solved per hue for 6.5 and
3.2 alternately; ΔE is CIE76, deutan by Viénot 1999). Hue sets differ per direction (R16):

```text
instrument light: series #10635c #8a8d17 #145f79 #847ae9 #7522d4 #cf52e3 #a11a7d #e4568a (min 3.21; dE 22.1, deutan 8.9)
  seq #e5fbf9 #b0f2ed #73e8de #18958b #10605a; div #13726a #7beae0 #f8f9fb #d47bea #5f1372; label 5.71
instrument dark: series #1eb9ac #717413 #32b3de #675ce4 #be94ee #ba22d1 #eb82cf #d42263 (min 3.20; dE 24.5, deutan 4.7)
  seq #0a3d39 #10605a #15847a #58e4d8 #9fefe9; div #8dece4 #15847a #1e2228 #6e1584 #d98dec; label 4.61
control-room light: series #095e6f #798f0c #08614a #7478f4 #5f19ec #c64ff1 #9e0d81 #f04181 (min 3.20; dE 26.5, deutan 5.2)
  seq #e3f8fd #aae9f8 #68d7f3 #0d83a0 #085568; div #0a647b #71daf4 #f6f8fa #f471c4 #7b0a51; label 4.77
control-room dark: series #11b4d4 #65770a #0fba90 #565cf1 #b594f6 #b113eb #f476db #d8115a (min 3.20; dE 32.1, deutan 7.9)
  seq #053642 #085568 #0b748e #4cd0f0 #97e4f7; div #84dff5 #0b748e #19212c #8e0b5e #f584cc; label 5.38
ledger light: series #4d43c0 #858e2f #206158 #3b91b1 #7538a9 #c65fca #923172 #cc6789 (min 3.21; dE 15.8, deutan 8.4)
  seq #e8e9f7 #babce8 #8587d6 #2b2e82 #1c1e54; div #212363 #8c8fd9 #faf7f2 #8cd9d2 #21635e; label 6.43
ledger dark: series #a7a2e0 #707828 #3ebbab #327b95 #be9add #b53eba #db92c2 #c1466f (min 3.20; dE 11.0, deutan 3.2)
  seq #121336 #1c1e54 #262973 #6e71cf #abade3; div #9c9ede #262973 #28241f #26736c #9cded8; label 4.93
worst case per pair: ink-2 on page/surface/surface-2 5.72; ink 13.47; control border 3.06; accent text on
page/surface/surface-2/accent-tint 4.65; text on accent fill 5.36; tone ink on its tint and every background 5.59;
tone fill (no text) on every background 3.05; series on every background 3.20; black/white label on a ramp cell 4.61
```

**Role → token (one rule).** Remapped: page `neutral-100`, surface `surface`, surface-2 `neutral-50`, line
`neutral-200`, control `control`, ink `neutral-900`, ink-2 `neutral-600`, accent `accent`/`accent-strong`/
`accent-text`, on-accent `accent-ink`, tint `accent-tint`; critical → `danger-*`, attention → `warning-*` and
`hold-*`, good → `ok-*`, info → `info-*` and `moved-*`, neutral → `muted-*` (base, ink, tint each); series 1–2 →
`chart-1/2`. **Not remapped:** `neutral-300/400/500/700/800` (6 uses in the kit), `shadow-card`, `shadow-sheet`,
`radius-*`, `font-sans` and the text sizes; series 3–8, ramps, the variant's shadow, radius and serif live under
`--proto-*`. So kit elements (the floor step, Button, Sheet) change colour per direction but keep today's depth,
corners and type in all three; only the prototype's own parts show the variant's depth and shape.

**R14 — Running on the real floor step.** The picker's own screens show Running grey through `variant.ts`'s map. The
real floor step reuses `FloorMachineRow`, whose `StatusPill` reads `ticket.running` as `ok`, so **it shows today's
green Running until ticket 82 changes `ticket.ts`**; no picker packet edits `ticket.ts` or a kit token, because the
70 baselines can only be regenerated in 81's Docker run.

**R4–R8 — how they are built.**

- **Place.** `apps/web/src/gallery/directions/`: `variant.ts` (types, `ROLES`, the 40-status map, an `en-IN`
  formatter), one `direction-<name>.ts` each (variant, light, dark), `harness.tsx`, `picker.css` (PICKER.md
  verbatim), `parts-tile.tsx`, `parts-chart.tsx`, `screen-<name>.tsx`, `floor-sample.ts`, `generated/figures.json`.
  The harness finds directions and screens with `import.meta.glob`; each file registers its own copy in a
  `directions` i18n namespace (en, and `ક ખ ગ ·` sample letters for gu, as `gallery/strings.ts:186-191`). `Gallery.tsx`
  gains one lazy early return beside `?view=desktop` (`:118`); the 15 sections, 70 baselines and `Gallery-` chunk
  test do not move.
- **Opening it.** `/gallery?view=directions&v=1&s=today&theme=light&lang=en`; keys 1–3 and ←/→ per PICKER.md;
  screen (Elements, Today, Machine, Breakdowns, Floor step), theme and language in a plain `SegmentedBar` above.
- **R7 token switch.** `document.documentElement.style.setProperty` per role for the current theme, removed on
  switch and unmount; inline style beats `:root` and `[data-theme='dark']`; a test asserts both themes set the same
  keys. **R8 remount:** the stage is keyed `${direction}-${theme}-${lang}` (the chart reads its palette once).
- **Data.** `tools/directions-figures.ts` (node) writes the figures of `dashboard`, `machine-page` (VC-28),
  `breakdown-log`, `a1-bd-pm`, `a2-category-cell`, `a3-mttr-mtbf`, `a10-problems`, drill ids dropped, tables cut to
  50 rows, ≤ 250 KB, under `generated/` (skipped by `pr-size`, added to `.prettierignore`); `--check` exits 1 when
  missing or stale. Screens read it with the existing mappers, read-only, and say "as of 11 Nov 2026". **N3:** the
  picker formats with its own `en-IN` formatter and the Elements screen shows a fixed sample 10,00,000; the real
  formatter is 83/86's.
- **The screens.** Elements: each part per variant, the palette strip, the sample number. Today: six tiles (1,279
  breakdowns; 3,060.1 h downtime; 99.32 % availability; 4.11 complaints a day; 759.3 h PM; breakdown-free
  machines), ranked costliest problems, one trend, a tone strip. Machine (VC-28): header, grey Running chip, four
  reliability tiles, a trend, the last 10 breakdowns. Breakdowns: KPI strip, Pareto (`mixed`), category × cell heat
  grid on the sequential ramp, MTTR/MTBF bars, the log's first 50 rows. Floor step: the real
  `faces/floor/machine-step.tsx` on a sample `FloorData`, untouched (R14).
- **R6 serving.** The gallery dev server alone, run in `apps/web` as `vite --host 0.0.0.0 --port 3100 --strictPort`,
  port 3100 reported to the app (_inferred: the preview reaches Nimish's phone_); a scratch Playwright script (not
  committed) captures 60 PNGs (3 × 5 screens × 360/1440 × light/dark) into one private artifact page.
- **After the pick.** 80s records it and writes the values; the folder, script and specs stay until 81's first
  packet copies the winner into `ui/tokens.css` and deletes them together (R9).

## E. Packets

One pull request each, ≤ 3 authored files and about 150 lines; one declared exception (80l). Vendored copies and
generated JSON are not authored lines. **Tracker:** 80a sets row 80 to `in progress` (the only `MILESTONES.md`
edit before 80s, which sets `done`); 80a merges first and alone, so no `feat(80…)` commit ever meets a `todo`
row. **Builders:** at most three at once, one per file area, so after 80a three lanes run: docs (80b → 80f),
tools (80g, about an hour, then free) and gallery (80h → 80k, then 80l once 80g has merged, → 80r).

| Id  | One assertion                                                     | Files                                                                                                                                  | Red → green                                                                                                     | After          | Nimish                 |
| --- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | -------------- | ---------------------- |
| 80a | Emil's 8 skills installed with their licence; row 80 in progress  | `THIRD_PARTY.md`, `MILESTONES.md` (row 80), vendor `NOTICE.md`; 8 vendored dirs                                                        | `for s in <8>; do test -f .claude/skills/$s/LICENSE; done && grep -q emilkowalski THIRD_PARTY.md`; `docs:check` | —              | no                     |
| 80b | `PRODUCT.md` names every user, device and setting                 | `PRODUCT.md` (~90), impeccable `SKILL.md` (1 line), learn-taste `SKILL.md` (1 line)                                                    | `grep -q 'impeccable:product-schema 1' PRODUCT.md`                                                              | 80a            | TV size                |
| 80c | DESIGN.md §1–4 exist in impeccable's shape                        | `docs/DESIGN.md` (~140), `tools/design-doc.test.ts` (~50)                                                                              | `pnpm vitest run tools/design-doc.test.ts`                                                                      | 80b            | no                     |
| 80d | DESIGN.md §5–8 exist; TAG-SYSTEM points to it                     | `docs/DESIGN.md` (~120), the test (+20), `TAG-SYSTEM.md` (1 line)                                                                      | the test's §5–8 case                                                                                            | 80c            | no                     |
| 80e | LOCK and CLAUDE.md approve one mockup per template for analytics  | `LOCK.md`, `CLAUDE.md` (1 line)                                                                                                        | `grep -c 'Amended by D33' docs/design/LOCK.md` 0 → 1; `docs:check`                                              | 80d            | go for the CLAUDE line |
| 80f | D04 and D27 say "Amended by D33"                                  | D04, D27                                                                                                                               | `grep -L 'Amended by D33' <both>` lists 2 → 0                                                                   | 80e            | no                     |
| 80g | The screens' figures come from `run()` on the answer key          | `tools/directions-figures.ts` (~70), `.prettierignore` (+1); `generated/figures.json`                                                  | `pnpm tsx tools/directions-figures.ts --check` exits 1 → 0                                                      | 80a            | no                     |
| 80h | One map gives all 40 statuses a tone; Running is neutral          | `variant.ts` (~80), `directions.test.ts` (~90)                                                                                         | `pnpm vitest run apps/web/src/gallery/directions`                                                               | 80a            | no                     |
| 80i | Instrument defines every role, light and dark, at its contrast    | `direction-instrument.ts` (~90), the test (+1 slug)                                                                                    | the test fails on the listed slug → passes                                                                      | 80h            | no                     |
| 80j | Control Room, likewise                                            | `direction-control-room.ts`, the test (+1)                                                                                             | as 80i                                                                                                          | 80i            | no                     |
| 80k | Ledger, likewise                                                  | `direction-ledger.ts`, the test (+1)                                                                                                   | as 80i                                                                                                          | 80j            | no                     |
| 80l | The picker flips directions, keeps `?v=`, restores `<html>`       | `harness.tsx` (~140), `Gallery.tsx` (+5), `e2e/gallery/directions.spec.ts` (~60), `picker.css` (verbatim) — **the exception**: 4 files | `pnpm exec playwright test -c playwright.gallery.config.ts directions`                                          | 80g, 80k       | no                     |
| 80m | Tile shape, delta form and 10,00,000 show per direction           | `parts-tile.tsx` (~110), `screen-elements.tsx` (~30), the spec (+20)                                                                   | the spec's "variants differ" case                                                                               | 80l            | no                     |
| 80n | Legend place and chart frame differ; series 3–8 and ramps show    | `parts-chart.tsx` (~130), `screen-elements.tsx` (+15), the spec (+15)                                                                  | the spec's "chart variants" case                                                                                | 80m            | no                     |
| 80o | Today prints its six tiles from the snapshot                      | `screen-today.tsx` (~120), the spec (+20)                                                                                              | the spec's Today case                                                                                           | 80n            | no                     |
| 80p | The machine page prints VC-28 with a grey Running chip            | `screen-machine.tsx` (~110), the spec (+20)                                                                                            | the spec's Machine case                                                                                         | 80o            | no                     |
| 80q | Breakdowns prints Pareto, heat grid and only 50 log rows          | `screen-breakdowns.tsx` (~130), the spec (+20)                                                                                         | the spec's Breakdowns case                                                                                      | 80p            | no                     |
| 80r | The floor step keeps v3 positions and reads in Gujarati           | `screen-floor.tsx` (~40), `floor-sample.ts` (~70), the spec (+30)                                                                      | the spec's Floor and Gujarati cases                                                                             | 80q            | no                     |
| 80s | The pick is recorded and DESIGN.md holds every value; row 80 done | `docs/DESIGN.md`, the design-doc test (+1 case), `docs/plan/ledger.md`; `MILESTONES.md` row 80 by the orchestrator in the same PR      | the case "every role has a light and a dark value equal to the winner's file"                                   | 80f, 80r, pick | **the pick**           |

Nimish is asked to pick only after 80r merges and the 60 pictures are published. 80s deletes nothing.

**Given / When / Then.**

- 80a: Given the 8 copied dirs, then each holds `LICENSE`, `THIRD_PARTY.md` names the skills with MIT, row 80 reads
  `in progress`, and `docs:check` and `pii:scan` report 0 problems.
- 80b: Given SPEC, DOMAIN §3 and LOCK, when `init` runs (no launcher), then `PRODUCT.md` names operator (shared
  low-end Android, floor, Gujarati), technician and supervisor (desk, phone), head and plant head (laptop and phone,
  analytics), admin (laptop), board (wall TV, always dark) with the TV size Nimish confirms.
- 80c/80d: Given DESIGN.md, then the front matter parses with `yaml`, the headings are in order, and every name in
  `ROLES` (5 tones × ink/tint/fill, 10 neutral and accent roles, 8 series, 2 ramps, 3 depth levels, 3 tiers, 5
  templates, 13 elements, empty/loading/error) is present.
- 80e: Given LOCK, then it opens "Amended by D33 (19 Nov)": rule 3 stays "built like the mockup PNG" for floor and
  desk (the only proof of positions until 89) and reads "one approved template" for analytics; rule 5 reads "a new
  role is a DESIGN.md change"; the status table gains an analytics column (Waiting amber, Transferred blue, Running
  grey) while floor and desk chips change in 82/88; the type rule adds the analytics tile value (28, 32 or 40 per
  the pick); rule 1 is unchanged. `CLAUDE.md:56` reads "one approved mockup per template (`docs/design/LOCK.md`)".
- 80f: Given D04 and D27, then D04's tone table points to DESIGN.md §2 with Running neutral; D27's "no tooltip, no
  legend, two series, no dark" become 84's rules, its "custom chart code: zero" names HTML ranked bars and heat-grid
  cells (each with its numbers table) as allowed non-ECharts marks, and D27 is accepted.
- 80g: Given the answer key, when the script runs twice, then `--check` exits 0 and every table has ≤ 50 rows.
- 80h: Given `variant.ts`, when all 40 statuses are mapped, then danger → critical, hold → attention, moved → info,
  `ticket.running` → neutral, and `en-IN` prints 1000000 as "10,00,000".
- 80i–80k: Given the direction, then light and dark set the same keys, cover `ROLES`, every text pair is ≥ 4.5 and
  every fill, series and border ≥ 3 against page, surface and surface-2 (inks also against their tint), and no
  series equals a status value or sits in a reserved band.
- 80l: Given `/gallery?view=directions` at 360 and 1440, when 1, 2, 3 are pressed, then `?v=` follows, axe reports
  0, there is no horizontal scroll, and leaving removes every inline property.
- 80m/80n: Given the Elements screen, then `[data-tile]`, `[data-delta]`, `[data-legend]` and `[data-chart-frame]`
  take three different values across the directions, and the sample reads "10,00,000" in each.
- 80o–80q: Given each direction × theme at 360 and 1440, then tiles print the snapshot's values with unit and `%`,
  every status has icon and word, Running is grey, no list paints more than 50 rows, axe 0.
- 80r: Given `lang=gu` at 360 px, then no label clips or overflows in any direction, and the floor step's search,
  group tiles and "Other work" keep the same DOM order and third of the screen in all three.
- 80s: Given Nimish's pick in the ledger, then DESIGN.md's values equal the winner's `direction-*.ts`.

## F. Risks and conflicts

| #   | Risk or conflict                                                                                 | Ruling                                                                                    | Cost if wrong                                                    |
| --- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| R1  | Two homes for DESIGN.md                                                                          | `docs/DESIGN.md`; two one-line notes (80b)                                                | A stray root file; one move                                      |
| R2  | Vendored skills tripping checks                                                                  | Outside every check (verified)                                                            | None now                                                         |
| R3  | A webfont is a dependency in all but name                                                        | None: Ledger uses a named system serif stack                                              | Ledger looks plainer than a bought face                          |
| R4  | Baselines are made only in Docker                                                                | 80 edits no token, kit file or gallery section; its specs take no screenshots             | A moved baseline fails CI and cannot be fixed here               |
| R5  | Three screens decide 92                                                                          | The pick is a token set plus a variant map; 85 approves templates again                   | D33: two files change and every screen follows                   |
| R6  | Nimish cannot open the dev server                                                                | Port-3100 preview plus the 60-picture artifact                                            | He judges pictures, not motion                                   |
| R7  | Token precedence                                                                                 | Inline properties; same keys in both themes (tested)                                      | A stale role from the other theme                                |
| R8  | Charts keep their first palette                                                                  | Stage keyed by direction, theme, language                                                 | A chart in the wrong colours                                     |
| R9  | The test-deletion hook blocks removing the specs in 81                                           | Removed with their surface in one commit, as a ledger ruling; a person runs it if refused | A stale spec until removed                                       |
| R10 | Files at the limit                                                                               | `use-chart.ts` 394, `page-content.ts` 399, `figure-content.ts` 387 untouched              | A 400-line breach fails `size`                                   |
| R11 | Weak colour-blind separation of 8 series (min deutan ΔE 3.2)                                     | Every series named by legend or label; 81 validates and may reorder                       | A misread chart                                                  |
| R12 | LOCK rule 5 would block every token PR                                                           | 80e: "a new role is a DESIGN.md change, approved with its template"                       | Every token PR waits for Nimish                                  |
| R13 | v3 holds real names and calls a live API                                                         | Capture with all network blocked and a planted fictional client (B §4)                    | Real personal data in a picture                                  |
| R14 | The real floor step shows Running green                                                          | Accepted until 82; the picker's own screens show grey                                     | Nimish judges the floor step's Running colour wrongly            |
| R15 | Distinct statuses share a colour: S2/S3, Waiting/Support, In progress/Transferred, Offline/Draft | Accepted: icon and word tell them apart (D33 §1), and four tones is what N2 asked for     | If people confuse them, 82 gives one pair a second tone; one map |
| R16 | Hue sets differ per direction only by order, offset and saturation                               | The free bands are narrow once red, amber, green and info blue are reserved               | Directions look alike in charts; 81 may widen a band             |

**Correction for the orchestrator (not made here):** ticket 81's goal 1 says "4 status tones"; the plan has four
plus neutral, so it should read "4 status tones plus neutral, each with ink, tint and fill".

## Open questions for Nimish

Only the TV's size (80b), the go for the `CLAUDE.md` line (80e) and the pick itself (80s).
