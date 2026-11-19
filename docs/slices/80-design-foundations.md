# F-80 — Design foundations (ticket 80)

Ticket 80 (`docs/plan/MILESTONES.md:671-678`): the design file everything in F is built from, with no change to
what any user sees. Goals: (1) `PRODUCT.md` and a new `docs/DESIGN.md` that defines 100 % of the roles 81–89 use;
(2) D04, D27 and `docs/design/LOCK.md` amended under D33, approval per template, Emil Kowalski's skills installed with
their licence; (3) three directions of Today, a machine page and Breakdowns at 360 and 1440 px behind the
`prototype` picker, and Nimish picks one. Blocked by 73 (in progress, `MILESTONES.md:148`): no packet is dispatched
before 73 merges, and every 80 pull request moves the 80 tracker row (19 Nov rule 6; 73's check enforces it).
Authority: D33, D04, D20, D27, D09, LEAN, LOCK rule 1. Every fork below is a numbered ruling (R1–R12) with its cost.

## A. Facts (verified in this checkout, `58161f2`, 19 Nov; "inferred" is marked)

| Fact                     | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tokens                   | `apps/web/src/ui/tokens.css` (173 lines): 72 light names (66 in `@theme`, 6 in `:root`), 40 dark overrides (`[data-theme='dark']`), 1 Gujarati leading, 2 reduced-motion, 2 blue-accent. By role: colour 44 (accent 5, surface 1, control 1, neutral 10, tone 7, ink 7, tint 7, old alias 6), chart 4 (series 1, series 2, axis, grid), text 12, leading 1, font 1, radius 4 (8, 12, 16, sheet 20), shadow 2 (card, sheet), spacing 2 (target 52, target-min 44), motion 2 (150, 250 ms). No depth level 3, no third chart colour, no ramps, no dark chart values |
| Type                     | Six UI sizes 12/14/16/20/24/32 (`text-caption` … `text-title1`) plus six TV sizes 40–160 used only by `screens/board/scale.ts` and `screens/Board.tsx`; weights 400/600/700/800 (`LOCK.md:28-30`); system stack with Noto Sans Gujarati fallback (`tokens.css:2-3`)                                                                                                                                                                                                                                                                                               |
| Meaning                  | 41 statuses in 10 groups (`ui/status/*.ts`) on 7 tones: danger 8, muted 8, hold 6, ok 6, warning 6, info 5, moved 1. `ui/meaning.ts` (60 lines) maps 6 segment codes to icons (fallback `Factory`), `statusMeaning()`, and `TONE_FILL`/`TONE_TEXT` for the 7 tones plus accent                                                                                                                                                                                                                                                                                    |
| Icons                    | 63 Lucide icons exported from `ui/icon.ts`; `tools/check-ui.ts` fails `lucide-react` anywhere else                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Charts in code           | `ui/chart/use-chart.ts` is 394/400 lines: kinds `bar`, `line`, `scatter`, `mixed`; a bar holds at most 2 series (tuple type, `:35`); `Palette.series` is a 2-tuple (`:84-91`); modules Bar, Line, Scatter, Grid, Tooltip, SVG only (`:105-112`); no Legend, no Heatmap; `animation: false` (`:138`); the tooltip is used by scatter only (`:265`). `chart-guard.test.ts` keeps ECharts in the one door and out of start-up and `Gallery-` chunks; no test enforces a byte budget (the 174 KB is D27's measurement)                                                |
| Gallery                  | `/gallery` loads in dev or with `VITE_GALLERY=on` (`App.tsx:26-30`); 15 sections plus `?view=desktop` (`gallery/Gallery.tsx:110-169`), switchers lang/accent/theme; 70 PNG baselines in `apps/web/e2e/gallery/__screenshots__/` (4 specs, 849 lines). Regenerated only by `pnpm gallery:update:docker` (pinned `mcr.microsoft.com/playwright:v1.65.0-noble` + `fonts-noto-core`, `tools/gallery-baselines.sh`); CI's gallery job runs in the same image (`.github/workflows/ci.yml:174-205`)                                                                      |
| `check-ui`               | 68 lines; in `faces/` only: no `className`, no `style`, no raw colour, ≤ 120 lines per `.tsx`; everywhere: Lucide only via `ui/icon.ts`. CI runs it (`ci.yml:83`); `precheck` skips it (`tools/precheck.ts:5`)                                                                                                                                                                                                                                                                                                                                                    |
| Hand-written cards       | `shadow-card` 57 times in 46 files under `screens/` + `components/`; `rounded-2xl bg-surface` 47 times in 39 files (MILESTONES' "57 in 39" mixes the two); one raw colour in screens (`EnergyGrids.tsx:32`)                                                                                                                                                                                                                                                                                                                                                       |
| Patterns                 | Used by real screens: `frame` (17 files), `view-state` (12), `crud-spec` (11), `wide` (6), `wizard-page` (5), `crud-page` (4), `sync-status` (3), `form-sheet` (2), `queue-page` (2). Gallery only: `board-page`, `dashboard-page`, `detail-page`                                                                                                                                                                                                                                                                                                                 |
| Analytics                | 8 groups (`screens/analytics/groups.ts:33-85`); Today renders `Dashboard`, Breakdowns `BreakdownsPage`, the machine page `MachinePage` (`Analytics.tsx:65-90`). The figure tile hand-writes its card (`FigureTile.tsx:122`). Near the limit: `page-content.ts` 399, `figure-content.ts` 387                                                                                                                                                                                                                                                                       |
| Engine on the answer key | `run(ENGINE_DATA, '2026-11-11', DEFAULT_PROFILE)` (fixture `packages/domain/test/answer-key/fixture.ts:344`) gives 51 figures, 48 ready, 26 screens, 1.14 MB of JSON in 3.1 s (measured). The fixture reads files with `node:fs` (`answer-key/keys.ts:11`), so it cannot run in a browser. Today + machine page + Breakdowns figures are 0.80 MB before trimming (measured)                                                                                                                                                                                       |
| Dev server alone         | `pnpm --filter @uptimo/web exec vite --host 127.0.0.1 --port 3100 --strictPort` serves `/gallery` with no API (verified, HTTP 200) and serves repo files outside `apps/web` through `/@fs` (verified on `fixtures/answer-key/dashboard.json`)                                                                                                                                                                                                                                                                                                                     |
| Docker, Playwright       | Docker client present, no daemon (verified): baselines cannot be made here. Playwright's headless shell 1254 was installed into `/opt/pw-browsers` during planning; the gallery screenshot test then fails locally on `tokens-en.png` (font rendering, verified). Functional and axe specs can run here; screenshots are judged only in CI                                                                                                                                                                                                                        |
| impeccable               | v4.8.1, pinned without `scripts/` (local note `.claude/skills/impeccable/SKILL.md:10`): `scripts/impeccable context` does not exist, so the skill falls back to reading `docs/DESIGN.md` and `PRODUCT.md`. `init` writes `PROJECT_ROOT/PRODUCT.md` after one interview round (`reference/init.md`, Steps 3–4); `document` wants DESIGN.md with YAML front matter and eight sections in a fixed order (`reference/document.md:1-60`). No `PRODUCT.md` and no `.impeccable/` exist                                                                                  |
| Licences on file         | `THIRD_PARTY.md` lists Ponytail (`:68`) but neither impeccable (Apache-2.0) nor pstack (MIT). Vendoring convention: `.claude/vendor/pstack/{LICENSE,NOTICE.md}`, skills copied to `.claude/skills/<name>/`; prettier ignores `.claude/skills` and `.claude/vendor`; ESLint ignores `.claude/**`                                                                                                                                                                                                                                                                   |
| What the checks read     | `docs:check` reads 5 instruction files plus `.claude/agents/*.md` for the process markers, and `docs/adr/0001-stack.md`, `docs/spec/SPEC.md`, `THIRD_PARTY.md` for Drizzle (`tools/check-docs.ts:15-47`); it never reads `.claude/skills/` or `.claude/vendor/`. `pii:scan` reads every git-tracked file except `docs/discovery/` and the lockfile. `licences` reads only production npm packages                                                                                                                                                                 |
| Stale design docs        | `docs/DESIGN.md` (22 lines: one accent, "don't use bolder modes"); `docs/design/TAG-SYSTEM.md` uses `#0d9488`, which fails 4.5:1 (D20); `FRONTEND-STRATEGY.md:3` fixes the system font; LOCK contradicts itself on Running ("running stays neutral", `LOCK.md:128-129`, against the chip table's green, `:53`; code says `ok`, `ui/status/ticket.ts:19`)                                                                                                                                                                                                          |
| Bhavin's look            | `docs/discovery/source/cosmos_platform.html`: Inter and JetBrains Mono from Google Fonts, accent `#2563eb`, radius 10, surfaces `#f7f8fa`. v3 `maint.html`: system font, radius 12, the same accent. People read his five status colours (red, blue, amber, violet, orange; `FRONTEND-STRATEGY.md:13`)                                                                                                                                                                                                                                                            |

**Where the two files live (R1).** `PRODUCT.md` at the repository root, where `init` writes new files. DESIGN.md stays
`docs/DESIGN.md`: CLAUDE.md, AGENTS.md, D04, D33, MILESTONES and the impeccable pin note all name that path, and the
launcher that would resolve another path is not installed. The impeccable note (`SKILL.md:10`) gains the root
`PRODUCT.md` path, and learn-taste gets a one-line local note naming `docs/DESIGN.md`, so no root `DESIGN.md` ever
splits the authority. No `.impeccable/design.json` sidecar: only the live panel reads it and it cannot run here.
_Cost if wrong:_ one move and three path edits.

## B. What the new `docs/DESIGN.md` must answer

Shape: impeccable's front matter (`colors`, `typography`, `rounded`, `spacing`, `components`, the keys being the
role names below) and its eight sections in order; product rules are subsections, never extra top-level sections.
Values are named by role; `ui/tokens.css` stays the one place a value lives, and ticket 81 adds a test that the
front matter and `tokens.css` agree. Written in two passes: the grammar before the pick (80c), the values after (80l).

1. **Overview.** The north star in one line. The two zones (D33 §3) by route: floor `/floor/*`, desk `/desk/*`
   including the board, TV and ticket, and settings keep v3 flow, order, button position and words; analytics
   `/analytics/*` is free. Mode: Operate everywhere. Which users and devices (pointer to `PRODUCT.md`). The bar:
   `impeccable critique` ≥ 32/40 with 0 P0, axe 0, 360 px first.
2. **Colors.** (a) Neutral roles: page, surface 1–3, line, line-strong, ink 1–3, focus ring, control border.
   (b) Accent: fill, ink on fill, text, tint; where the accent is allowed (actions and the current choice, never a
   status). (c) **Status-tone grammar:** four tones (critical, attention, good, info) plus neutral, each with ink,
   tint and fill; what each means for a status, a severity, a risk and a figure's direction; the rule "tone, icon
   and word, never colour alone"; where a tone may fill (chips, bars, heat cells, a 3 px edge) and where it may
   only be ink; at most one critical fill per card. (d) **The mapping of all 41 statuses** from 7 tones to 4 and
   neutral (draft in 80c, Nimish's Q1–Q2 settle it). (e) **Direction of good** per figure kind (downtime down is
   good, availability up is good) so a delta takes its tone from the figure, not the sign. (f) Chart colours: 8
   categorical (never a status hue, checked for colour-blind separation), 1 sequential, 1 diverging, axis, grid,
   label; 3:1 for marks. (g) Light and dark values with their contrast numbers.
3. **Typography.** Family per the pick (system, or one self-hosted face under an ADR) and the Gujarati fallback
   with 1.55 leading; the six UI sizes and six TV sizes, which role uses which; numerals tabular in every figure
   and table; KPI value size per density tier; weights; line length; truncation and wrapping for a 40-character
   Gujarati label (wrap to two lines, then ellipsis with the full text on focus).
4. **Layout.** Breakpoints 360, 768, 1024, 1440 and TV 1920. **Density tiers** — phone (one column, 2 KPI tiles per
   row, 16 gutter, 44/52 targets, 10 rows before "more"), laptop (12 columns, 4–6 tiles per row, 36 px table rows
   for pointer only, 50 rows per page), TV (read at 3 m, TV sizes, no pointer, no money). The five templates
   (overview, analysis, register, entity, work queue): regions in order, what each holds at each tier. Grouped
   navigation (8 groups), the drill trail, the period picker's place. The two-zone rule applied: what a floor or
   desk screen may change (colour, type, depth, motion) and may not (order, third of the screen, words).
5. **Elevation & Depth.** Three levels — 0 page (flat), 1 raised (cards, tiles, list groups), 2 overlay (sheets,
   menus, tooltips) — the shadow or surface step for each in light and dark, and where each is allowed (no level 1
   inside level 1; floor rows stay level 1; TV uses level 0 and 1 only).
6. **Shapes.** Radius per role (control, card, sheet, chip, tile), border versus shadow, table rules, focus ring.
7. **Components.** (a) The 13 elements of 83: anatomy, states, tones, sizes per tier; the KPI tile in full (label,
   value + unit, delta vs the previous period with its tone and word, sparkline, drill). (b) **Charts:** the
   decision table "a number is a tile when it is one current value; a trend when it has ≥ 6 periods; a bar when it
   compares ≤ 12 categories; a ranked list or Pareto when it compares more; a heatmap when it crosses two
   dimensions; a table always, behind Show the numbers"; legend at ≥ 2 series; tooltip and tap on phone; axis
   from zero for bars; units on axes; sort orders; reduced motion. (c) **Icons:** Lucide via `ui/icon.ts` only,
   16/20/24 px, stroke 2, segment icons from the meaning map. (d) **Motion:** 150/250 ms, ease-out, what may move
   (sheet, chip select, tab indicator, skeleton) and what never moves (figures, chart redraws, list rows on the
   floor); 0 ms under reduced motion. (e) **Numbers:** grouping (Q3), `%` on every percentage, units, "—" for no value.
8. **Do's and Don'ts.** Concrete guardrails, the floor/desk prohibitions first; each later correction from Nimish
   is added by `learn-taste` with its date comment.

## C. Emil Kowalski's skills (`/home/user/emilkowalski/skills`, MIT, commit `64eb3de`, 20 skills)

| Skill                                                                                    | Verdict | Ticket                               | Reason                                                                                 |
| ---------------------------------------------------------------------------------------- | ------- | ------------------------------------ | -------------------------------------------------------------------------------------- |
| `prototype` (+ `PICKER.md`)                                                              | use     | 80 (85 if a template needs variants) | The picker for the three directions; the PICKER spec is copied verbatim                |
| `emil-design-eng`                                                                        | use     | 83, 85, 87, 88                       | Press, focus and popover craft for the kit; shadows over borders                       |
| `apple-design`                                                                           | use     | 80, 83                               | Depth, materials and type sections of DESIGN.md; its spring/gesture parts are not used |
| `break-ui` (+ `CATALOG.md`)                                                              | use     | 83, 86, 87                           | 83's goal 2 (40-character Gujarati label, 7-digit number, 0 items)                     |
| `mobile-native`                                                                          | use     | 89 (83 for inputs)                   | 89's goal 2 checklist: input zoom, 100vh, safe areas, stuck hover, tap flash           |
| `animation-performance`                                                                  | use     | 84, 89                               | Chart draw and sheet motion on a low-end Android                                       |
| `review-animations` (+ `STANDARDS.md`)                                                   | use     | 83, 85                               | The motion review before a template is approved                                        |
| `learn-taste`                                                                            | use     | 80 onward                            | Writes each of Nimish's corrections into `docs/DESIGN.md`                              |
| `animate`                                                                                | not now | —                                    | Motion is two durations and four moving things; DESIGN.md §7d is enough                |
| `improve-animations`, `find-animation-opportunities`, `choreograph`, `remove-animations` | no      | —                                    | The app has almost no motion; Operate surfaces gain nothing from more                  |
| `animation-vocabulary`                                                                   | no      | —                                    | A glossary for prompting; no deliverable needs it                                      |
| `gestures`                                                                               | no      | —                                    | v3's taps stay (LOCK rule 1); the one sheet is Radix                                   |
| `pick-ui-library`                                                                        | no      | —                                    | Its picks (recharts, motion, base-ui, clsx, cva, Vaul) contradict D20, D27 and LEAN    |
| `ask-emil`                                                                               | no      | —                                    | A router over all 20; with 8 installed it points at missing skills                     |
| `ask-sonner`, `animate-expo`, `write-swift`                                              | no      | —                                    | Sonner, React Native and Swift are not used                                            |

**Install (R2).** Copy the 8 "use" skills verbatim into `.claude/skills/<name>/` (no name collides with the 67
existing ones; checked), each with the upstream `LICENSE` beside its `SKILL.md`, as Ponytail's skills do. Add
`.claude/vendor/emilkowalski-skills/{LICENSE,NOTICE.md}` in the pstack layout: source, commit, the 8 copied, the 12
left out and why, and the one local change (learn-taste's note "In this repo DESIGN.md is `docs/DESIGN.md`").
`THIRD_PARTY.md` "Tools" gains three rows: Emil Kowalski skills (8 of 20, MIT), impeccable 4.8.1 (Apache-2.0, its
own `NOTICE.md`), pstack 0.15.36 (MIT). `prototype`, `learn-taste` and `review-animations` carry
`disable-model-invocation: true`: an agent cannot call them, so builders `Read` the file and follow it; only
Nimish types `/prototype`.

**Install test, run in this worktree and removed.** The 8 skills, the vendor notice and the `THIRD_PARTY.md` row
were copied and staged (so `pii:scan`'s `git ls-files` sees them). Results: `docs:check` "7 instruction files, 3
stack files, 0 problem(s)"; `licences` "218 production licence entries, 0 outside the allowlist"; `pii:scan` "153
names and 0 phones … 2169 files scanned; 0 problem(s)"; `deps` 22 runtime dependencies; `size` unchanged. A grep of
all 20 skills for the process markers, Drizzle and phone-shaped numbers found nothing. The copies were unstaged and
deleted; this commit holds only this plan.

## D. Three directions

All three: D33 (red/amber/green only with icon and word; legend and tooltip; floor/desk positions untouched), the
same three screens with the same figures, the existing kit (`StatusPill`, `Button`, `Chart`) restyled by tokens
alone. Contrast below was computed (WCAG formula) for ink, secondary ink, accent and every tone's ink on its tint
and on the surface (≥ 4.5) and every fill and chart mark on the surface (≥ 3); all pass.

**1. Instrument** — axis: refined light, layered depth. A precise instrument panel on paper-white: every figure
sits on a softly raised card, numbers are large and tabular, and colour appears only where a status or a series
needs it. It finishes today's world (teal kept) rather than replacing it.

- Light: page `#f4f5f7`, surface `#ffffff`, ink `#15171a` (18.0), ink-2 `#5b616b` (6.2), accent `#0f766e` (5.5,
  white on it 5.5). Tones ink/tint/fill: critical `#b42318`/`#fdecea`/`#d92d20`, attention `#93370d`/`#fef4e6`/
  `#dc6803`, good `#05603a`/`#e7f6ec`/`#079455`, info `#1d4ed8`/`#e8effd`/`#2e6be6`, neutral `#475467`/`#eef0f3`.
  Series 1–4 `#0f766e` `#2e6be6` `#7a5af8` `#dd2590`.
- Dark: page `#0e1013`, surface `#171a1f`, ink `#f2f4f7`, ink-2 `#a3abb7`, accent `#2dd4bf` (ink on it `#04201d`);
  tones critical `#f97066`/`#3b1714`, attention `#fdb022`/`#3a2709`, good `#47cd89`/`#0f2e1f`, info `#84adff`/`#172440`.
- Type: system stack (no dependency); KPI 32/700 tabular, tracking −0.01em at ≥ 24 px; labels 14/600.
- Depth and radius: level 1 `0 1px 2px rgb(16 24 40/.06), 0 4px 12px rgb(16 24 40/.06)`, level 2
  `0 12px 32px rgb(16 24 40/.18)`; dark uses surface steps and a `#2b3038` hairline. Radius control 10, card 14,
  sheet 20, chip full.
- KPI tile: white card, label above, value + unit, a tinted delta chip ("▲ 12 % vs Oct" with arrow icon and the
  figure's tone), a 48 px accent sparkline. Status chip: tint, ink text, 16 px icon, 28 px high, round. Chart: 2 px
  lines, 3 px rounded bar tops, legend chips above, tooltip card at level 2. Table: no vertical rules, sticky
  header, numbers right-aligned, row hover on surface 2.

**2. Control Room** — axis: dark-first, dense, signals that glow. A plant control room at night: graphite panels,
status that stands out of the dark, more figures per screen, equally at home on the wall TV and a laptop.

- Dark (default for analytics if picked; Q4): page `#0b0f14`, panel `#121821`, raised `#19212c`, overlay `#212b38`,
  line `#2a3544`, ink `#e6edf5` (15.1), ink-2 `#9aa7b8` (7.3), accent `#22d3ee` (9.9; ink on it `#04141a`). Tones:
  critical `#ff7a7a`/`#3a1418`/`#ff5c5c`, attention `#ffb84d`/`#3a2808`/`#ffa41b`, good `#4ade80`/`#0e2e1c`/
  `#22c55e`, info `#7cb8ff`/`#11233d`/`#3b9bff`. Series 1–4 `#22d3ee` `#a78bfa` `#f472b6` `#9aa7b8`.
- Light: page `#eef1f5`, surface `#ffffff`, ink `#0b1220`, ink-2 `#4a5568`, accent `#0e7490` (5.4); tones as D04's
  inks (`#b91c1c`, `#92400e`, `#166534`, `#1d4ed8`) on tints `#fdeaea`, `#fdf1dc`, `#e5f5ea`, `#e7eefd`.
- Type: system stack; figures 600 tabular, −0.02em; English labels 12/600 +0.02em (Gujarati never tracked).
- Depth and radius: no shadows; depth is the surface step plus a 1 px line; radius 6 control, 8 card, 12 sheet,
  4 chip (a tag, not a pill).
- KPI tile: compact two rows, a 3 px tone edge on the left with icon and word, value 28, filled sparkline at 12 %.
  Chip: 1 px tone outline, tone ink, dark ground. Chart: luminous series, inline legend, crosshair tooltip, the
  heat grid prominent. Table: 36 px rows with a pointer, 44 px on a phone; row lines `#2a3544`.

**3. Ledger** — axis: warm paper, typographic, ruled. A well-kept engineering logbook: warm paper, ink rules and
one strong typeface, figures set like a printed report; depth comes from rules and weight, not shadows.

- Light: page `#f6f3ee`, surface `#fffdf9`, rule `#ddd5c8`, strong rule `#1c1917`, ink `#1c1917` (17.2), ink-2
  `#57534e` (7.5), accent indigo `#3538cd` (8.0, white on it 8.1). Tones: critical `#b42318`/`#fbe9e7`/`#c8321f`,
  attention `#8a4b08`/`#faf0dc`/`#c27803`, good `#2f6b2f`/`#e9f2e3`/`#3f8f3f`, info `#1e4f91`/`#e6eef8`/`#2f6fc0`.
  Series 1–4 `#3538cd` `#8e3fb0` `#2f6fc0` `#78716c`.
- Dark: page `#171512`, surface `#201d19`, ink `#f4efe7`, ink-2 `#b5ab9c`, accent `#a4a7ff`; tones critical
  `#ff8a7a`/`#3d1a15`, attention `#f5b74a`/`#3a2a0e`, good `#8fd18f`/`#1b2e1b`, info `#8fb8f0`/`#16263a`.
- Type: IBM Plex Sans (OFL-1.1), self-hosted woff2, Latin subset, 400 and 600; Gujarati falls back to the phone's
  Noto Sans Gujarati. KPI 40/600; section heads 20/600 under a 2 px ink rule. Tabular figures in Plex: _inferred,
  the 80h builder verifies with `font-feature-settings: 'tnum'` on a 7-digit number._
- Depth and radius: flat; cards are 1 px ruled boxes, only overlays carry `0 16px 40px rgb(28 25 23/.2)`; radius 4.
- KPI tile: no card, a ruled cell in a 2- or 4-column grid, the delta in words ("12 % more than October") with
  arrow icon and tone ink. Chip: square tint with icon. Chart: ink axes, flat bars, direct end labels up to 3
  series, a key row beyond. Table: ledger rules, 2 px header rule, tabular numbers.

**Does a webfont count (R3)?** Yes. It is third-party code shipped to every phone, though `check-deps` cannot see
it: LEAN's "no new dependency without an ADR", D04/D20's system font and `FRONTEND-STRATEGY.md:3` all apply. In the
prototype the files live inside the prototype folder (fetched once from the npm registry with `npm pack
@fontsource/ibm-plex-sans`, never added to `package.json`, with `OFL.txt` beside them) and are deleted if Ledger
loses. If Ledger wins, 81 writes **D35 "One self-hosted UI typeface"**: woff2 in `apps/web/public/fonts/`,
`font-display: swap`, `woff2` added to the PWA precache patterns (`apps/web/vite.config.ts:20`, today only
js/css/html/png/webmanifest, so the offline floor would lose the face), a `THIRD_PARTY.md` row (OFL-1.1 is on the
allowlist), the measured bytes; rejected: Google Fonts (a third-party request from every factory phone, no offline),
`@fontsource` as a dependency (a package for two files), the system stack (Instrument and Control Room use it).

**How they are built (R4–R7).**

- **Place.** `apps/web/src/gallery/directions/`: `harness.tsx` (picker, screen and theme switch), `picker.css`
  (PICKER.md verbatim; its raw `rgba` is legal outside `faces/`), one `<name>.ts` + `<name>.css` per direction, one
  `screen-<name>.tsx` per screen, `strings.ts` (a `directions` i18n namespace, registered like
  `gallery/strings.ts:193-196`), `figures.json`. `Gallery.tsx` gains one early return beside `?view=desktop`
  (`:118`) that lazy-loads the harness, so the 15 sections and the 70 baselines are byte-identical and the
  `Gallery-` chunk test still holds. Nothing outside `gallery/directions/` imports from it.
- **Opening it.** `/gallery?view=directions&v=1&s=today&theme=light`. Keys 1–3 and ←/→ flip directions (`?v=`),
  per PICKER.md; screen (Today, Machine, Breakdowns) and theme sit in a plain `SegmentedBar` at the top, because the
  picker itself may not change. Width is the device's own: Nimish opens it on his phone (360) and laptop (1440).
- **Token switch.** The harness sets `data-direction` on `<html>` and removes it on unmount (as
  `useDocumentAttributes` does, `Gallery.tsx:82-108`). Each CSS file overrides the existing token names under
  `:root[data-direction='x']` and `:root[data-direction='x'][data-theme='dark']` (specificity 0,2,0 and 0,3,0 beat
  `:root` and `[data-theme='dark']`); Tailwind 4 utilities read `var(--color-…)` at run time, so the kit restyles
  without an edit. Roles that are not tokens yet use `--proto-*` names inside the folder only.
  `ui/tokens.css`, `ui/chart/use-chart.ts` and every file in `screens/` stay untouched.
- **Data.** `tools/directions-figures.ts` (node) runs `run(ENGINE_DATA, '2026-11-11', DEFAULT_PROFILE)` on the
  answer-key fixture and writes the figures of `dashboard`, `machine-page` (VC-28 only), `breakdown-log`,
  `a1-bd-pm`, `a2-category-cell`, `a3-mttr-mtbf` and `a10-problems`, drill ids dropped, tables cut to 50 rows,
  target ≤ 250 KB; `--check` exits 1 when the file is missing or stale. The screens read it with the existing
  mappers, read-only (`contentOf`, `unitOf`, `FIGURE_LABELS`); no server, no API, no React Query.
- **The screens.** Today: six tiles (breakdowns 1,279; downtime 3,060.1 h; fleet availability 99.32 %; complaints
  4.11 a day; PM 759.3 h; breakdown-free machines), the costliest problems as a ranked list, one trend, a tone strip.
  Machine page (VC-28): header with segment icon and a status chip, four reliability tiles, a trend, the last 10
  breakdowns. Breakdowns: a KPI strip, a Pareto (the `mixed` chart: bars + cumulative line), the category × cell
  heat grid in HTML (as `EnergyGrids.tsx` does), MTTR/MTBF bars, and the log's first 50 rows (the live screen paints 1,343). Legends are
  HTML chips; charts stay within today's two-series door.
- **Serving (R6).** The gallery dev server alone is enough: the orchestrator runs
  `pnpm --filter @uptimo/web exec vite --host 0.0.0.0 --port 3100 --strictPort` and reports port 3100 to the app,
  so Nimish opens the preview on phone and laptop (_inferred: that the preview reaches his phone_). For the record,
  a scratch Playwright script (system Chrome or the installed headless shell, not committed) captures 36 PNGs
  (3 directions × 3 screens × 360/1440 × light/dark) into one private artifact page, the way LOCK's mockups were
  approved. Staging cannot show it: its build has no `VITE_GALLERY`. Nothing goes into `__screenshots__`.
- **After the pick (R7).** 80l deletes the two losing `<name>.ts`/`.css` pairs (and the fonts if Ledger loses) and
  records the ruling. The winner, harness, `figures.json` and `tools/directions-figures.ts` stay until 81's first
  packet has copied the winning values into `ui/tokens.css`; that packet then deletes `gallery/directions/`, the
  script and the directions specs together, as the prototype skill's Phase 6 says.

## E. Packets

Each is one pull request, ≤ 3 authored files and about 150 lines unless the line says why. Vendored copies and
generated JSON are not authored lines.

| Id  | One assertion                                                            | Files                                                                                                                                                                                         | Red → green                                                                                                                                                  | Order                               | Nimish                             |
| --- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------- | ---------------------------------- |
| 80a | Emil's 8 skills are installed with their licence; the checks stay green  | `THIRD_PARTY.md`, `.claude/vendor/emilkowalski-skills/NOTICE.md`, `.claude/skills/impeccable/SKILL.md` (1 line); 8 vendored dirs                                                              | `test -f .claude/skills/prototype/PICKER.md && grep -q emilkowalski THIRD_PARTY.md` fails → passes; then `pnpm docs:check && pnpm licences && pnpm pii:scan` | parallel                            | no                                 |
| 80b | `PRODUCT.md` names every user, device and setting                        | `PRODUCT.md` (~90 lines)                                                                                                                                                                      | `grep -q 'impeccable:product-schema 1' PRODUCT.md` fails → passes                                                                                            | parallel                            | yes: one round, ≤ 3 questions (Q5) |
| 80c | DESIGN.md's grammar exists in impeccable's shape                         | `docs/DESIGN.md` (~230), `tools/design-doc.test.ts` (~70) — over 150: one document and its test                                                                                               | `pnpm vitest run tools/design-doc.test.ts` fails → passes                                                                                                    | after 80b                           | yes: Q1–Q3                         |
| 80d | D04, D27 and LOCK say they are amended by D33; approval is per template  | D04, D27, `LOCK.md`, + 1 line atop `TAG-SYSTEM.md` (4th file, a one-line pointer)                                                                                                             | `grep -L 'Amended by D33' <the three>` lists 3 → 0; `pnpm docs:check`                                                                                        | after 80c                           | no                                 |
| 80e | The three screens' figures come from `run()` on the answer key           | `tools/directions-figures.ts` (~70), `figures.json` (generated)                                                                                                                               | `pnpm tsx tools/directions-figures.ts --check` exits 1 → 0                                                                                                   | parallel                            | no                                 |
| 80f | The picker flips directions with 1–3 and keeps `?v=`; Instrument renders | `harness.tsx` (~150), `picker.css` (verbatim), `instrument.ts`+`.css`, `strings.ts`, `Gallery.tsx` (+5), `e2e/gallery/directions.spec.ts` — over 3: the CSS is copied and the hook is 5 lines | `pnpm exec playwright test -c playwright.gallery.config.ts directions` fails → passes                                                                        | after 80e                           | no                                 |
| 80g | Control Room is a second direction                                       | `control-room.ts`, `control-room.css`, `strings.ts` (+1)                                                                                                                                      | the spec's per-direction test `-g "control-room"` finds no test (exit 1) → passes                                                                            | after 80f                           | no                                 |
| 80h | Ledger is a third direction with its face                                | `ledger.ts`, `ledger.css`, `strings.ts` (+1); `fonts/` (2 woff2 + `OFL.txt`)                                                                                                                  | `-g "ledger"` exit 1 → passes                                                                                                                                | after 80g                           | no                                 |
| 80i | Today renders its six tiles from the snapshot in every direction         | `screen-today.tsx` (≤ 250), `e2e/gallery/directions-today.spec.ts`                                                                                                                            | that spec fails → passes                                                                                                                                     | after 80f, parallel with g, h, j, k | no                                 |
| 80j | The machine page renders VC-28 in every direction                        | `screen-machine.tsx`, `directions-machine.spec.ts`                                                                                                                                            | as 80i                                                                                                                                                       | parallel                            | no                                 |
| 80k | Breakdowns renders its Pareto, heat grid and only 50 log rows            | `screen-breakdowns.tsx`, `directions-breakdowns.spec.ts`                                                                                                                                      | as 80i                                                                                                                                                       | parallel                            | no                                 |
| 80l | Nimish's pick is recorded and DESIGN.md has every value                  | `docs/DESIGN.md`, `tools/design-doc.test.ts` (+1 test), `docs/plan/ledger.md`; deletes the two losers                                                                                         | the new test "every role has a light and a dark value" fails → passes                                                                                        | after a–k and the pick              | yes: the pick                      |

**Given / When / Then.**

- 80a: Given the 8 copied dirs, when `docs:check`, `licences`, `pii:scan` run, then each prints 0 problems and
  `THIRD_PARTY.md` names the skills with MIT.
- 80b: Given SPEC, DOMAIN §3 and LOCK, when the builder runs impeccable `init` (launcher absent, so its fallback),
  then `PRODUCT.md` names operator (shared low-end Android, floor, Gujarati), technician and supervisor (desk on a
  phone), head and plant head (laptop and phone, analytics), admin (laptop), board (wall TV); facts Nimish did not
  confirm are marked inferred.
- 80c: Given DESIGN.md, when the test reads it, then the front matter parses with `yaml`, the eight headings appear
  in order, and every role in the test's `ROLES` list (4 tones × ink/tint/fill, neutral, 8 + 2 chart roles, 3 depth
  levels, 3 density tiers, 5 templates, 13 elements) is named.
- 80d: Given D04, D27 and LOCK, when read, then each opens with "Amended by D33 (19 Nov)": D04's tone table and
  "green for running" point to DESIGN.md §2; D27's "no tooltip, no legend, two series, no dark" become 84's rules
  and D27 is accepted; LOCK rule 3 reads one mockup per template, rule 5 a DESIGN.md role change, rule 1 unchanged.
- 80e: Given the answer key, when the script runs, then `figures.json` holds the 7 screens' figures with VC-28 and
  ≤ 50 rows per table, and a second run with `--check` exits 0.
- 80f: Given `/gallery?view=directions`, when key 1 is pressed at 360 and 1440 px, then `data-direction` is set, the
  URL holds `v=1`, axe reports 0 violations, the page has no horizontal scroll, and leaving removes the attribute.
- 80g/80h: Given the picker, when key 2 (3) is pressed, then the KPI tile's background, radius and font family
  differ from direction 1's, and light and dark both pass axe.
- 80i–80k: Given each direction and theme at 360 and 1440 px, when the screen is chosen, then its tiles print the
  snapshot's values with unit and `%`, every status shows icon and word, no list paints more than 50 rows, axe 0.
- 80l: Given Nimish's pick in the ledger, when the test runs, then every colour role in DESIGN.md has a light and a
  dark value equal to the winner's file, and only the winner's files remain in `gallery/directions/`.

## F. Risks and conflicts

| #   | Risk or conflict                                                         | Ruling                                                                                                                | Cost if wrong                                                                                    |
| --- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| R1  | Two homes for DESIGN.md (impeccable and learn-taste default to the root) | `docs/DESIGN.md` stays; two one-line local notes                                                                      | A stray root file splits authority; one move                                                     |
| R2  | Vendored skills tripping checks                                          | `.claude/skills/` and `.claude/vendor/` are outside every check (verified)                                            | None now; if `docs:check` widens to skills, the grep above is the proof they pass                |
| R3  | A webfont is a dependency in all but name                                | Prototype only; ADR D35 in 81 if Ledger wins; PWA precache                                                            | Plex adds bytes on 3G and mixes with Gujarati glyphs; one file of tokens reverts                 |
| R4  | Baselines are only made in the pinned Docker image; no daemon here       | 80 changes no baseline: no edit to `tokens.css`, the kit or the 15 sections; the directions specs take no screenshots | A changed baseline would fail CI and could not be regenerated here; 81 owns the one regeneration |
| R5  | A direction judged on 3 screens is applied to 92                         | The picker overrides only tokens, so the pick is a token set; templates are approved again in 85                      | D33: two files change and every screen follows                                                   |
| R6  | Nimish cannot open a dev server                                          | Port 3100 preview plus the 36-PNG artifact                                                                            | He picks from pictures only; motion is not judged                                                |
| R7  | The test-deletion hook blocks removing the directions specs in 81        | The removal goes with its surface in one commit, as a ledger ruling; a person runs it if the hook refuses             | A stale spec that fails until removed                                                            |
| R8  | Files at the limit                                                       | `use-chart.ts` 394, `page-content.ts` 399, `figure-content.ts` 387 are not touched; prototype `.tsx` ≤ 300            | A 400-line breach fails `size`                                                                   |
| R9  | `pick-ui-library` advice reaching a builder                              | Not installed                                                                                                         | A dependency without an ADR (LEAN)                                                               |
| R10 | Four tones drop violet and orange, which operators read today            | Q2 to Nimish before 80c merges                                                                                        | Floor chips change meaning for trained operators                                                 |
| R11 | `figures.json` is 11 Nov data, not live                                  | Labelled "11 Nov 2026" on every screen                                                                                | None: prototype only                                                                             |
| R12 | LOCK rule 5 ("a new size or colour is a new decision") blocks 81–89      | 80d rewrites it as "a new role is a DESIGN.md change, approved with its template"                                     | Every token PR would wait for Nimish                                                             |

## Open questions for Nimish (product only)

1. **Running.** Is a running machine shown green, or quiet grey so stopped machines stand out? (LOCK says both.)
   Recommendation: grey on boards and lists; green only for "fixed", "confirmed" and "target met".
2. **Waiting and Transferred.** With four status colours, Waiting becomes amber and Transferred blue, each keeping
   its icon and word. Operators read orange and violet today. Is that acceptable on the floor and desk?
3. **Numbers.** 1,00,000 (Indian grouping) or 100,000? Today the figures print 100,000 (`FigureTile.tsx:22`, `en-GB`).
4. **If Control Room wins:** does analytics open dark by default, or follow the phone's setting?
5. **PRODUCT.md (80b):** confirm the users and devices listed above, the TV's size, and whether operators share one
   phone per cell.
