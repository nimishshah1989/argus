# F-80 — Design foundations (ticket 80)

Ticket 80 (`docs/plan/MILESTONES.md:671-678`): the design file everything in F is built from, with no change to
what any user sees. Goals: (1) `PRODUCT.md` and a new `docs/DESIGN.md` that defines 100 % of the roles 81–89 use;
(2) D04, D27 and `docs/design/LOCK.md` amended under D33, approval per template, Emil Kowalski's skills installed with
their licence; (3) three directions of Today, a machine page and Breakdowns at 360 and 1440 px behind the
`prototype` picker, and Nimish picks one. Blocked by 73 (in progress, `MILESTONES.md:148`). Authority: D33, D04, D20,
D27, D09, LEAN, LOCK rule 1. Every fork is a numbered ruling (R1–R14) with its cost.

**Revision 2 (19 Nov, after a fresh review and Nimish's answers).** The directions now differ by a variant map as
well as by colour; every role is given for every direction in light and dark, computed; the webfont is dropped;
packets fit the budget; the floor's LOCK rule 3 stays.

## Settled by Nimish (19 Nov, product)

| #   | Question                | Answer                                                                                                                                                           |
| --- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| N1  | Running                 | Grey (neutral). Stopped, waiting and transferred stand out; running is quiet. Green stays for fixed, confirmed and target met                                    |
| N2  | Waiting and Transferred | Waiting is amber (attention), Transferred is blue (info), each keeping its icon and word. The old orange and violet are retired on the floor, desk and analytics |
| N3  | Numbers                 | Indian grouping (1,00,000). Money keeps the form it already prints, "₹ 38.23 lakh" (`apps/web/src/screens/analytics/figures-43.test.ts:194`)                     |
| N4  | Theme                   | Analytics follows the device's light or dark setting; the TV board is always dark (both already in `useSystemTheme`, `screens/desk/Shell.tsx:52-58`)             |
| N5  | Shared phones           | Settled by `docs/design/LOCK.md:97`; `PRODUCT.md` needs one confirmation from Nimish only: the TV's size                                                         |

## A. Facts (verified in this checkout, 19 Nov; "inferred" is marked)

| Fact                 | Evidence                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tokens               | `apps/web/src/ui/tokens.css` (173 lines): 72 light names (66 `@theme`, 6 `:root`), 40 dark overrides. Colour 44 (accent 5, surface 1, control 1, neutral 10, tone 7, ink 7, tint 7, old alias 6), chart 4, text 12, leading 1, font 1, radius 4, shadow 2, spacing 2 (52/44 targets), motion 2. No third depth level, no third chart colour, no ramps, no dark chart values                                    |
| Type                 | Six UI sizes 12/14/16/20/24/32 and six TV sizes 40–160 (`screens/board/scale.ts`, `screens/Board.tsx`); weights 400/600/700/800 (`LOCK.md:28-30`); system stack with Noto Sans Gujarati (`tokens.css:2-3`)                                                                                                                                                                                                     |
| Meaning              | 40 statuses in 10 groups (`ui/status/*.ts`: ticket 8, floor 3, report 2, severity 4, clock 5, handback 4, pm 3, forecast 3, sync 4, task 4) on 7 tones (danger 8, muted 8, hold 6, ok 6, warning 6, info 5, moved 1). `ui/meaning.ts`: 6 segment icons, `statusMeaning()`, `TONE_FILL`/`TONE_TEXT`                                                                                                             |
| Icons                | 63 Lucide icons exported from `ui/icon.ts`; `tools/check-ui.ts` fails Lucide anywhere else                                                                                                                                                                                                                                                                                                                     |
| The chart door today | `ui/chart/use-chart.ts` 394/400 lines. Bar: ≤ 2 series (`:34`), value labels. Line: end labels, series 2 dashed with triangles (`:225-230`). Scatter: the only tooltip (`:265`). Mixed: stacked bars + dashed line (the Pareto, `:304-330`). Palette = 2 series colours, axis, grid, font, 7 tones (`:84-91`), read once at first draw (`:369`). No Legend, no Heatmap module (`:105-112`); `animation: false` |
| Gallery              | `/gallery` in dev or with `VITE_GALLERY=on` (`App.tsx:26-30`); 15 sections plus `?view=desktop` (`Gallery.tsx:118`); 70 baselines, regenerated only in the pinned image (`pnpm gallery:update:docker`, `tools/gallery-baselines.sh`); CI's gallery job uses the same image (`ci.yml:174-205`)                                                                                                                  |
| `check-ui`           | In `faces/` only: no `className`, `style`, raw colour, > 120 lines; Lucide only via `ui/icon.ts`. CI runs it (`ci.yml:83`)                                                                                                                                                                                                                                                                                     |
| Hand-written cards   | `shadow-card` 57 times in 46 files under `screens/` + `components/`; `rounded-2xl bg-surface` 47 times in 39 files; one raw colour (`EnergyGrids.tsx:32`)                                                                                                                                                                                                                                                      |
| Patterns             | Real screens use `frame` (17 files), `view-state` (12), `crud-spec` (11), `wide` (6), `wizard-page` (5), `crud-page` (4), `sync-status` (3), `form-sheet` (2), `queue-page` (2); gallery only: `board-page`, `dashboard-page`, `detail-page`                                                                                                                                                                   |
| Engine on the key    | `run(ENGINE_DATA, '2026-11-11', DEFAULT_PROFILE)`: 51 figures, 48 ready, 26 screens, 1.14 MB in 3.1 s (measured); the fixture reads files with `node:fs` (`packages/domain/test/answer-key/keys.ts:11`), so not in a browser                                                                                                                                                                                   |
| Dev server, Docker   | `vite --port 3100` serves `/gallery` with no API and repo files via `/@fs` (verified). Docker has no daemon (verified). With Playwright's headless shell (installed in `/opt/pw-browsers` while planning) the gallery screenshot test fails locally on fonts; functional and axe specs run here                                                                                                                |
| impeccable           | 4.8.1 pinned without `scripts/` (`.claude/skills/impeccable/SKILL.md:10`): no launcher, so it reads `docs/DESIGN.md` and `PRODUCT.md`. `init` writes `PRODUCT.md` at the root after one interview round; `document` wants front matter and eight sections in a fixed order                                                                                                                                     |
| Checks               | `docs:check` reads 5 instruction files, `.claude/agents/*.md`, 3 stack files and (since 73b) the tracker table; never `.claude/skills/` or `.claude/vendor/`. `pii:scan` reads every tracked file but `docs/discovery/`. `pr-size` skips `docs/`, `.md`, `fixtures/`, `generated/` (`tools/check-pr-size.ts:7`). Neither impeccable nor pstack is in `THIRD_PARTY.md`                                          |
| Stale design docs    | `docs/DESIGN.md` (22 lines, one accent); `TAG-SYSTEM.md` uses `#0d9488` (fails 4.5:1, D20); LOCK says Running both neutral (`:128-129`) and green (`:53`); code says `ok` (`ui/status/ticket.ts:19`). N1 settles it                                                                                                                                                                                            |
| Bhavin's look        | `cosmos_platform.html`: Inter and JetBrains Mono from Google Fonts, accent `#2563eb`, radius 10. v3 `maint.html`: system font, radius 12                                                                                                                                                                                                                                                                       |

**R1 — where the files live.** `PRODUCT.md` at the root (where `init` writes); DESIGN.md stays `docs/DESIGN.md`
(CLAUDE.md, AGENTS.md, D04, D33 and the pin note name it). The pin note gains the root `PRODUCT.md`; learn-taste gets
a one-line note naming `docs/DESIGN.md`. No `.impeccable/design.json` (only the live panel reads it). _Cost:_ one move.

## B. What the new `docs/DESIGN.md` must answer

Impeccable's front matter (`colors`, `typography`, `rounded`, `spacing`, `components`, keyed by the role names
below) and its eight sections in order; product rules are subsections. `ui/tokens.css` keeps the values; 81 adds a
test that the two agree. 80c writes §1–4, 80d §5–8, 80r the winner's values.

1. **Overview.** North star. The two zones by route: `/floor/*`, `/desk/*` (board, TV, ticket) and settings keep v3
   flow, order, button position and words; `/analytics/*` is free. Operate mode. Pointer to `PRODUCT.md`. The bar:
   critique ≥ 32/40, 0 P0, axe 0, 360 px first.
2. **Colors.** Neutral roles (page, surface 1–2, line, control, ink 1–2, focus = accent); accent (fill, on-fill,
   text, tint; actions and the current choice, never a status). **Tone grammar:** critical, attention, good, info,
   neutral, each ink/tint/fill; "tone, icon and word, never colour alone"; a tone may fill a chip, bar, heat cell or 3
   px edge, otherwise ink only; one critical fill per card. **The 40-status map (one rule):** danger → critical;
   warning and hold → attention; info and moved → info; ok → good except `ticket.running` → neutral; muted →
   neutral (N1, N2). **Direction of good** per figure (downtime down, availability up). **Chart colours:** 8
   categorical, never a status value and never in the red (345–50°) or green (90–160°) hue bands, every series named
   by a legend or a label; one sequential and one diverging ramp, black or white labels on ramp cells; marks ≥ 3:1.
3. **Typography.** Families per the pick; Gujarati falls back to the OS face in every direction (Noto Sans Gujarati
   on Android and in the CI image; Nirmala UI on Windows and Gujarati Sangam MN on macOS, _inferred_); 1.55 leading in
   Gujarati; which role uses which of the six UI and six TV sizes; tabular figures; a 40-character Gujarati label wraps
   to two lines, then ellipsis with the full text on focus.
4. **Layout.** Breakpoints 360/768/1024/1440, TV 1920. **Density tiers:** phone (one column, 2 tiles a row, 16
   gutter, 44/52 targets, 10 rows before "more"), laptop (12 columns, 4–6 tiles, 36 px rows for a pointer only, 50
   rows a page), TV (read at 3 m, TV sizes, no pointer, no money, always dark, N4). The five templates (overview,
   analysis, register, entity, work queue) by region and tier; grouped navigation; drill trail; period picker.
   **Two-zone rule:** the floor and desk may change colour, type, depth and motion, never order, position or words.
   **How 89 measures "same third":** at 360 × 740, for each control in a v3↔ours mapping table (name, v3 selector,
   our role and name), DOM order index and `floor(centreY / (740 / 3))` must be equal. Bhavin's side is captured by
   opening `docs/discovery/bhavin-v3/maint.html` from disk in Playwright and saving one PNG and one JSON of control
   boxes per step to `docs/design/evidence/bhavin-v3/`, with the acting person set to a coded name so no real name is
   in a picture.
5. **Elevation & Depth.** Level 0 page, 1 raised (cards, tiles, list groups), 2 overlay (sheets, menus, tooltips):
   the shadow or surface step for each in light and dark; no level 1 inside level 1; TV uses 0 and 1 only.
6. **Shapes.** Radius per role (control, card, sheet, chip, tile); border versus shadow; table rules; focus ring.
7. **Components.** The 13 elements of 83 with anatomy, states, tones and tier sizes; the KPI tile in full (label,
   value and unit, delta against the previous period with tone and word, sparkline, drill); **empty, loading and
   error** for every element and template (what shows, the words' source, retry, the offline line, as `viewState`
   and `StateNotice` already split them, `patterns/view-state.ts`). **Charts:** a tile for one current value; a trend
   for ≥ 6 periods; a bar for ≤ 12 categories; a ranked list or Pareto for more; a heatmap for two dimensions; the
   table always, behind Show the numbers; legend at ≥ 2 series; tooltip and tap on a phone; bars from zero; units on
   axes. **Icons:** Lucide via `ui/icon.ts`, 16/20/24, stroke 2. **Motion:** 150/250 ms ease-out for sheet, chip,
   tab indicator, skeleton; figures, chart redraws and floor rows never move; 0 under reduced motion. **Numbers:**
   `en-IN` grouping (N3), money "₹ … lakh", `%` on every percentage, units, "—" for no value.
8. **Do's and Don'ts.** The floor/desk prohibitions first; later corrections added by `learn-taste` with a dated
   comment.

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

**R2 — install.** The 8 "use" skills verbatim into `.claude/skills/<name>/` (no name collides with the 67 present),
each with the upstream `LICENSE`; `.claude/vendor/emilkowalski-skills/{LICENSE,NOTICE.md}` (source, commit, the 8
copied, the 12 left out, the one local line in learn-taste). `THIRD_PARTY.md` "Tools" gains Emil Kowalski skills (8
of 20, MIT), impeccable 4.8.1 (Apache-2.0) and pstack 0.15.36 (MIT). `prototype`, `learn-taste` and
`review-animations` are `disable-model-invocation: true`: builders `Read` them; only Nimish types `/prototype`.
**Install test** (run here, then removed): with the 8 copied, staged and the row added, `docs:check` 0 problems,
`licences` 218 entries 0 outside the allowlist, `pii:scan` 0 problems in 2169 files, `deps` 22, `size` unchanged; a
grep of all 20 for the process markers, Drizzle and phone-shaped numbers found nothing.

## D. Three directions

All three obey D33 and N1–N4, render the same figures, and differ on two layers. **Tokens:** every role below,
applied by the harness as inline custom properties on `<html>` (R7). **Variant map:** a fixed object each direction
exports, read by the shared elements in `parts-*.tsx`:

| Variant field | Instrument                                                                                                                             | Control Room                                                    | Ledger                                                                     |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Idea          | Refined light, layered depth; finishes today's world                                                                                   | Dense, signals stand out of a graphite ground; TV-ready         | Warm paper, ruled lines, figures set like a printed report                 |
| `tile`        | `card`: raised card, label above, value 32/700                                                                                         | `edge`: flat panel, 3 px tone edge, value 28/600, 2 rows        | `ruled`: no card, ruled cell in a grid, value 40 serif                     |
| `delta`       | `chip`: tinted chip, arrow icon, "12 %"                                                                                                | `inline`: arrow and "12 %" in tone ink beside the value         | `words`: "12 % more than October" under the value                          |
| `legend`      | `above` the chart, as chips                                                                                                            | `inline` with the chart title                                   | `none`: line end labels and bar value labels only                          |
| `density`     | comfortable: 2 tiles a row phone, 4 laptop                                                                                             | compact: 2 phone, 6 laptop; 36 px rows with a pointer           | roomy: 1 tile a row phone, 3 laptop                                        |
| `chartFrame`  | inside a level-1 card, 192 px                                                                                                          | on a panel step, 160 px                                         | between two rules, 224 px                                                  |
| Type          | system stack                                                                                                                           | system stack, figures −0.02em                                   | system sans; figures and headings `ui-serif, Georgia, 'Noto Serif', serif` |
| Depth, radius | shadow L1 `0 1px 2px rgb(16 24 40/.06), 0 4px 12px rgb(16 24 40/.06)`, L2 `0 12px 32px rgb(16 24 40/.18)`; radius 10/14/20, chip round | no shadow, surface steps and a 1 px line; radius 6/8/12, chip 4 | flat, 1 px rules, L2 only `0 16px 40px rgb(28 25 23/.2)`; radius 4         |

Charts draw only what the door draws today: the same bar, line, scatter and mixed charts in every direction, with
the direction's series 1–2, axis (ink-2) and grid (line). Series 3–8, the ramps and the legends appear in HTML
(ranked bars, legend chips, the heat grid, a palette strip), never inside ECharts. **R3 — no webfont:** Ledger's
serif is a system stack (Android's Noto Serif, Georgia on Windows, New York on macOS via `ui-serif`; _inferred_), so
no D35 and no new dependency. Gujarati keeps the OS face (B §3) in all three.

**Every role, light and dark** (`page / surface / surface-2 / line / control / ink / ink-2 / accent / on-accent /
accent-tint`; then each tone `ink / tint / fill`):

| Direction    | Theme | Neutrals and accent                                                               | critical                  | attention (incl. Waiting) | good                      | info (incl. Transferred)  | neutral (incl. Running)   |
| ------------ | ----- | --------------------------------------------------------------------------------- | ------------------------- | ------------------------- | ------------------------- | ------------------------- | ------------------------- |
| Instrument   | light | `#f4f5f7 #ffffff #f8f9fb #e3e5e8 #8a9099 #15171a #5b616b #0f766e #ffffff #e3f2f0` | `#b42318 #fdecea #d92d20` | `#93370d #fef4e6 #dc6803` | `#05603a #e7f6ec #079455` | `#1d4ed8 #e8effd #2e6be6` | `#475467 #eef0f3 #667085` |
| Instrument   | dark  | `#0e1013 #171a1f #1e2228 #2b3038 #6f7785 #f2f4f7 #a3abb7 #2dd4bf #04201d #12302c` | `#f97066 #3b1714 #f04438` | `#fdb022 #3a2709 #f79009` | `#47cd89 #0f2e1f #17b26a` | `#84adff #172440 #528bff` | `#a3abb7 #262a31 #7d8694` |
| Control Room | light | `#eef1f5 #ffffff #f6f8fa #dfe4ea #7c8796 #0b1220 #4a5568 #0e7490 #ffffff #e0f2f7` | `#b91c1c #fdeaea #dc2626` | `#92400e #fdf1dc #d97706` | `#166534 #e5f5ea #16a34a` | `#1d4ed8 #e7eefd #2563eb` | `#4a5568 #e9edf2 #64748b` |
| Control Room | dark  | `#0b0f14 #121821 #19212c #2a3544 #5f6e82 #e6edf5 #9aa7b8 #22d3ee #04141a #0b2a33` | `#ff7a7a #3a1418 #ff5c5c` | `#ffb84d #3a2808 #ffa41b` | `#4ade80 #0e2e1c #22c55e` | `#7cb8ff #11233d #3b9bff` | `#9aa7b8 #1f2733 #6b7a8f` |
| Ledger       | light | `#f6f3ee #fffdf9 #faf7f2 #ddd5c8 #8a8178 #1c1917 #57534e #3538cd #ffffff #ecebfb` | `#b42318 #fbe9e7 #c8321f` | `#8a4b08 #faf0dc #c27803` | `#2f6b2f #e9f2e3 #3f8f3f` | `#1e4f91 #e6eef8 #2f6fc0` | `#57534e #efeae2 #78716c` |
| Ledger       | dark  | `#171512 #201d19 #28241f #3a342c #7a7166 #f4efe7 #b5ab9c #a4a7ff #14123a #25244a` | `#ff8a7a #3d1a15 #f0604d` | `#f5b74a #3a2a0e #e39b1a` | `#8fd18f #1b2e1b #5fb35f` | `#8fb8f0 #16263a #5c93dc` | `#b5ab9c #2c2822 #8a8278` |

**Series, ramps and contrast** — output of the planning script (WCAG 2.x luminance; series solved per hue at 7.0
and 3.2 alternately against the surface; ΔE is CIE76, deutan by Viénot 1999). Every pair passes: text on surface,
page and surface-2 ≥ 5.72, accent text ≥ 5.36, on-accent ≥ 5.36, accent on its tint ≥ 4.65, control border ≥ 3.22,
tone ink on tint ≥ 5.59, tone ink on surface ≥ 6.26, tone fill ≥ 3.19, series ≥ 3.20, ramp labels ≥ 4.61.

```text
instrument light: series #10635c #839819 #136174 #4c92e2 #3b40df #a37ae9 #911cae #e55db3 (3.21-7.09; min dE 17.3, deutan 2.0)
  sequential #e5fbf9 #b0f2ed #73e8de #18958b #10605a; diverging #13726a #7beae0 #f8f9fb #d47bea #5f1372; ramp label 5.71
instrument dark: series #1eb8ab #617112 #23b3d7 #1f6abf #9a9def #7f46e1 #d785eb #c32087 (3.21-7.06; min dE 26.1, deutan 5.7)
  sequential #0a3d39 #10605a #15847a #58e4d8 #9fefe9; diverging #8dece4 #15847a #1e2228 #6e1584 #d98dec; ramp label 4.61
control-room light: series #08645d #82990c #0a6177 #3f91ef #343aef #a577f4 #930fb4 #f14fb6 (3.21-7.08; min dE 19.4, deutan 3.2)
  sequential #e3f8fd #aae9f8 #68d7f3 #0d83a0 #085568; diverging #0a647b #71daf4 #f6f8fa #f471c4 #7b0a51; ramp label 4.77
control-room dark: series #0fb6a8 #5f7009 #12b1d9 #1067ca #979af7 #7e3cef #dd7df4 #c51083 (3.20-7.06; min dE 25.9, deutan 7.5)
  sequential #053642 #085568 #0b748e #4cd0f0 #97e4f7; diverging #84dff5 #0b748e #19212c #8e0b5e #f584cc; ramp label 5.38
ledger light: series #20615b #859632 #255f6e #5f91ca #4448c1 #9e7fd4 #85339a #ce6daa (3.21-7.07; min dE 14.1, deutan 3.1)
  sequential #e8e9f7 #babce8 #8587d6 #2b2e82 #1c1e54; diverging #212363 #8c8fd9 #faf7f2 #8cd9d2 #21635e; ramp label 5.36
ledger dark: series #3ebaaf #667326 #5db4c9 #396fac #a1a3e0 #7f56c7 #cd93db #b63d89 (3.21-7.07; min dE 21.4, deutan 5.8)
  sequential #121336 #1c1e54 #262973 #6e71cf #abade3; diverging #9c9ede #262973 #28241f #26736c #9cded8; ramp label 4.93
```

No series equals a status value or sits in a red, amber or green band (checked). Deutan separation is weak in light
(min ΔE 2.0–3.2): legal only because every series carries its name (B §2); 81 runs a palette validator and may
reorder. **Role → token (one rule):** page `neutral-100`, surface `surface`, surface-2 `neutral-50`, line
`neutral-200`, control `control`, ink `neutral-900`, ink-2 `neutral-600`, accent `accent`/`accent-strong`/
`accent-text`, on-accent `accent-ink`, tint `accent-tint`; critical → `danger-*`, attention → `warning-*` and
`hold-*`, good → `ok-*`, info → `info-*` and `moved-*`, neutral → `muted-*`; series 1–2 → `chart-1/2`, axis ink-2,
grid line; series 3–8, ramps and the variant's shadow/radius/serif under `--proto-*`. So no kit chip shows orange
or violet, and the prototypes' own chip uses the B §2 map, so Running is grey.

**R4–R8 — how they are built.**

- **Place.** `apps/web/src/gallery/directions/`: `variant.ts` (types, `ROLES`, the 40-status map), one
  `direction-<name>.ts` each (variant, light, dark), `harness.tsx`, `picker.css` (PICKER.md verbatim; raw `rgba` is
  legal outside `faces/`), `parts-tile.tsx`, `parts-chart.tsx`, `screen-<name>.tsx`, `floor-sample.ts`,
  `generated/figures.json`. The harness finds directions and screens with `import.meta.glob`, so adding one never
  edits it; each file registers its own copy in a `directions` i18n namespace (en, and `ક ખ ગ ·` sample letters for
  gu as `gallery/strings.ts:186-191` does), so no shared strings file. `Gallery.tsx` gains one lazy early return
  beside `?view=desktop` (`:118`); the 15 sections, the 70 baselines and the `Gallery-` chunk test do not move.
- **Opening it.** `/gallery?view=directions&v=1&s=today&theme=light&lang=en`; keys 1–3 and ←/→ per PICKER.md;
  screen (Elements, Today, Machine, Breakdowns, Floor step), theme and language in a plain `SegmentedBar` above.
- **R7 token switch.** The harness sets each role with `document.documentElement.style.setProperty` for the current
  theme and removes them on switch and unmount. Inline style beats `:root` and `[data-theme='dark']`, so there is no
  specificity tie; `directions.test.ts` asserts light and dark define the same key set.
- **R8 remount.** The stage is keyed `${direction}-${theme}-${lang}`: the chart reads its palette once (`:369`).
- **Data.** `tools/directions-figures.ts` (node) runs `run()` on the answer key and writes the figures of
  `dashboard`, `machine-page` (VC-28), `breakdown-log`, `a1-bd-pm`, `a2-category-cell`, `a3-mttr-mtbf`,
  `a10-problems`; drill ids dropped, tables cut to 50 rows, ≤ 250 KB; `--check` exits 1 when missing or stale. It
  lives under `generated/` (skipped by `pr-size`) and is added to `.prettierignore`. Screens read it with the
  existing mappers, read-only (`contentOf`, `unitOf`, `FIGURE_LABELS`); every screen says "as of 11 Nov 2026".
- **The screens.** Elements: one of each part per variant. Today: six tiles (1,279 breakdowns; 3,060.1 h downtime;
  99.32 % availability; 4.11 complaints a day; 759.3 h PM; breakdown-free machines), costliest problems as ranked
  bars, one trend, a tone strip. Machine (VC-28): header, a grey Running chip, four reliability tiles, a trend, the
  last 10 breakdowns. Breakdowns: KPI strip, Pareto (`mixed`), the category × cell heat grid on the sequential ramp,
  MTTR/MTBF bars, the log's first 50 rows. **Floor step:** the real `faces/floor/machine-step.tsx` on a sample
  `FloorData`, untouched, so only colour, type and depth change while every position stays v3's.
- **R6 serving.** The gallery dev server alone, run in `apps/web` as
  `vite --host 0.0.0.0 --port 3100 --strictPort`, port 3100 reported to the app (_inferred: the preview reaches Nimish's phone_). For the record, a
  scratch Playwright script (not committed) captures 60 PNGs (3 directions × 5 screens × 360/1440 × light/dark) into
  one private artifact page. Staging cannot show it (no `VITE_GALLERY`). Nothing goes into `__screenshots__`.
- **After the pick.** 80r deletes the two losing `direction-*.ts` and their slugs in the test. 81's first packet
  copies the winner into `ui/tokens.css`, then deletes `gallery/directions/`, the script and the specs together.

## E. Packets

One pull request each, ≤ 3 authored files and about 150 lines; one declared exception (80k). Vendored copies and
generated JSON are not authored lines. **Tracker:** the frontend orchestrator sets row 80 to `in progress` in the
first merged 80 PR and to `done` in 80r; no other packet edits `MILESTONES.md`. **Order:** one build at a time per
file area (CLAUDE.md), so the gallery packets are a chain; only different areas run in parallel.

| Id  | One assertion                                                  | Files                                                                                                                                              | Red → green                                                                                                                    | After          | Nimish       |
| --- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------- | ------------ |
| 80a | Emil's 8 skills installed with their licence; checks green     | `THIRD_PARTY.md`, vendor `NOTICE.md`, impeccable `SKILL.md` (1 line); 8 vendored dirs                                                              | `test -f .claude/skills/prototype/PICKER.md && grep -q emilkowalski THIRD_PARTY.md`; then `docs:check`, `licences`, `pii:scan` | —              | no           |
| 80b | `PRODUCT.md` names every user, device and setting              | `PRODUCT.md` (~90)                                                                                                                                 | `grep -q 'impeccable:product-schema 1' PRODUCT.md`                                                                             | —              | TV size      |
| 80c | DESIGN.md §1–4 exist in impeccable's shape                     | `docs/DESIGN.md` (~140), `tools/design-doc.test.ts` (~50)                                                                                          | `pnpm vitest run tools/design-doc.test.ts`                                                                                     | 80b            | no           |
| 80d | DESIGN.md §5–8 exist; TAG-SYSTEM points to it                  | `docs/DESIGN.md` (~120), the test (+20), `TAG-SYSTEM.md` (1 line)                                                                                  | the test's §5–8 case                                                                                                           | 80c            | no           |
| 80e | D04, D27 and LOCK say "Amended by D33"                         | D04, D27, `LOCK.md`                                                                                                                                | `grep -L 'Amended by D33' <the three>` lists 3 → 0; `docs:check`                                                               | 80d            | no           |
| 80f | The screens' figures come from `run()` on the answer key       | `tools/directions-figures.ts` (~70), `.prettierignore` (+1); `generated/figures.json`                                                              | `pnpm tsx tools/directions-figures.ts --check` exits 1 → 0                                                                     | —              | no           |
| 80g | One map gives all 40 statuses a tone; Running is neutral       | `variant.ts` (~70), `directions.test.ts` (~80)                                                                                                     | `pnpm vitest run apps/web/src/gallery/directions`                                                                              | —              | no           |
| 80h | Instrument defines every role, light and dark, at its contrast | `direction-instrument.ts` (~90), the test (+1 slug)                                                                                                | the test fails on the listed slug → passes                                                                                     | 80g            | no           |
| 80i | Control Room, likewise                                         | `direction-control-room.ts`, the test (+1)                                                                                                         | as 80h                                                                                                                         | 80h            | no           |
| 80j | Ledger, likewise                                               | `direction-ledger.ts`, the test (+1)                                                                                                               | as 80h                                                                                                                         | 80i            | no           |
| 80k | The picker flips directions, keeps `?v=`, restores `<html>`    | `harness.tsx` (~140), `Gallery.tsx` (+5), `e2e/gallery/directions.spec.ts` (~60), `picker.css` (verbatim) — **the exception**: 4 files, one copied | `pnpm exec playwright test -c playwright.gallery.config.ts directions`                                                         | 80f, 80j       | no           |
| 80l | Tile shape and delta form differ in all three directions       | `parts-tile.tsx` (~110), `screen-elements.tsx` (~30), the spec (+20)                                                                               | the spec's "variants differ" case                                                                                              | 80k            | no           |
| 80m | Legend place and chart frame differ; series 3–8 and ramps show | `parts-chart.tsx` (~110), `screen-elements.tsx` (+15), the spec (+15)                                                                              | the spec's "chart variants" case                                                                                               | 80l            | no           |
| 80n | Today prints its six tiles from the snapshot                   | `screen-today.tsx` (~120), the spec (+20)                                                                                                          | the spec's Today case                                                                                                          | 80m            | no           |
| 80o | The machine page prints VC-28 with a grey Running chip         | `screen-machine.tsx` (~110), the spec (+20)                                                                                                        | the spec's Machine case                                                                                                        | 80n            | no           |
| 80p | Breakdowns prints Pareto, heat grid and only 50 log rows       | `screen-breakdowns.tsx` (~130), the spec (+20)                                                                                                     | the spec's Breakdowns case                                                                                                     | 80o            | no           |
| 80q | The floor step keeps v3 positions and reads in Gujarati        | `screen-floor.tsx` (~40), `floor-sample.ts` (~70), the spec (+30)                                                                                  | the spec's Floor and Gujarati cases                                                                                            | 80p            | no           |
| 80r | The pick is recorded and DESIGN.md holds every value           | `docs/DESIGN.md`, the design-doc test (+1 case), `docs/plan/ledger.md`; deletes the losers                                                         | the case "every role has a light and a dark value equal to the winner's file"                                                  | 80e, 80q, pick | **the pick** |

Parallel lanes: {80a}, {80b → 80c → 80d → 80e}, {80f}, {80g → … → 80q}; 80r last. Nimish is asked to pick only after
80q merges and the 60 pictures are published.

**Given / When / Then.**

- 80a: Given the 8 copied dirs, when the three checks run, then each reports 0 problems and `THIRD_PARTY.md` names
  the skills with MIT.
- 80b: Given SPEC, DOMAIN §3 and LOCK, when `init` runs (no launcher), then `PRODUCT.md` names operator (shared
  low-end Android, floor, Gujarati), technician and supervisor (desk, phone), head and plant head (laptop and phone,
  analytics), admin (laptop), board (wall TV, always dark), with the TV size Nimish confirms.
- 80c/80d: Given DESIGN.md, when the test reads it, then the front matter parses with `yaml`, the headings appear in
  order, and every name in `ROLES` (5 tones × ink/tint/fill, 10 neutral and accent roles, 8 series, 2 ramps, 3
  depth levels, 3 tiers, 5 templates, 13 elements, empty/loading/error) is present.
- 80e: Given the three files, then each opens "Amended by D33 (19 Nov)". D04's tone table points to DESIGN.md §2 and
  Running is neutral; D27's "no tooltip, no legend, two series, no dark" become 84's rules and D27 is accepted;
  LOCK rule 3 stays "built like the mockup PNG" for floor and desk (the only proof of positions until 89) and reads
  "one approved template" for analytics; rule 5 reads "a new role is a DESIGN.md change"; rule 1 is unchanged.
- 80f: Given the answer key, when the script runs twice, then the second run with `--check` exits 0 and every table
  has ≤ 50 rows.
- 80g: Given `variant.ts`, when the test maps all 40 statuses, then danger → critical, hold → attention, moved →
  info, `ticket.running` → neutral, and no status maps to orange or violet.
- 80h–80j: Given the direction, then light and dark define the same keys, cover every `ROLES` name, every text pair
  is ≥ 4.5, every fill, series and control ≥ 3, and no series equals a status value or sits in a status band.
- 80k: Given `/gallery?view=directions` at 360 and 1440, when 1, 2, 3 are pressed, then `?v=` follows, axe reports
  0, there is no horizontal scroll, and leaving removes every inline property.
- 80l/80m: Given the Elements screen, when each direction is shown, then `[data-tile]`, `[data-delta]`, `[data-legend]`
  and `[data-chart-frame]` take three different values, and background, radius and figure font differ too.
- 80n–80p: Given each direction × theme at 360 and 1440, then the tiles print the snapshot's values with unit, `%`
  and Indian grouping, every status has icon and word, no list paints more than 50 rows, axe 0.
- 80q: Given `lang=gu`, then every label is rendered with no clipped or overflowing text at 360 px in all three
  directions, and the floor step's search, group tiles and "Other work" keep their DOM order and third of the screen
  in all three.
- 80r: Given Nimish's pick in the ledger, then only the winner's `direction-*.ts` remains and DESIGN.md's values
  equal it.

## F. Risks and conflicts

| #   | Risk or conflict                                       | Ruling                                                                            | Cost if wrong                                       |
| --- | ------------------------------------------------------ | --------------------------------------------------------------------------------- | --------------------------------------------------- |
| R1  | Two homes for DESIGN.md                                | `docs/DESIGN.md`; two one-line notes                                              | A stray root file; one move                         |
| R2  | Vendored skills tripping checks                        | Outside every check (verified)                                                    | None now                                            |
| R3  | A webfont is a dependency in all but name              | None: Ledger uses a system serif; no D35                                          | Ledger looks less distinct than a bought face would |
| R4  | Baselines are made only in Docker; no daemon here      | 80 edits no token, kit file or gallery section; its specs take no screenshots     | A moved baseline fails CI and cannot be fixed here  |
| R5  | Three screens decide 92                                | The pick is a token set plus a variant map; 85 approves templates again           | D33: two files change and every screen follows      |
| R6  | Nimish cannot open the dev server                      | Port-3100 preview plus the 60-picture artifact                                    | He judges pictures, not motion                      |
| R7  | Token precedence                                       | Inline properties; same keys in light and dark (tested)                           | A stale role from the other theme                   |
| R8  | Charts keep their first palette                        | Stage keyed by direction, theme, language                                         | A chart in the wrong colours                        |
| R9  | The test-deletion hook blocks removing the specs in 81 | Removed with their surface in one commit, as a ledger ruling; a person if refused | A stale spec until removed                          |
| R10 | Files at the limit                                     | `use-chart.ts` 394, `page-content.ts` 399, `figure-content.ts` 387 untouched      | A 400-line breach fails `size`                      |
| R11 | Weak colour-blind separation of 8 series in light      | Every series named; 81 validates and may reorder                                  | A legend-free chart misread                         |
| R12 | LOCK rule 5 would block every token PR                 | 80e: "a new role is a DESIGN.md change, approved with its template"               | Every token PR waits for Nimish                     |
| R13 | Bhavin's HTML holds real names                         | Capture with a coded acting person; reviewer checks every PNG before commit (89)  | Real personal data in a screenshot                  |
| R14 | Snapshot is 11 Nov data                                | "As of 11 Nov 2026" on every screen                                               | None: prototype only                                |

## Open questions for Nimish

None beyond the TV's size (80b) and the pick itself (80r).
