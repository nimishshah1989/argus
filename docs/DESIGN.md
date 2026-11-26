---
name: Uptimo
description: A quiet maintenance tool for the shop floor, the desk and the analytics screens of one plant.
colors:
  page: '#f5f5f7'
  surface: '#ffffff'
  surface-2: '#fafafa'
  line: '#e8e8ed'
  control: '#8e8e93'
  ink: '#1d1d1f'
  ink-2: '#6e6e73'
  accent: '#0f766e'
  on-accent: '#ffffff'
  accent-tint: '#e3f2f0'
  critical-ink: '#b91c1c'
  critical-tint: '#fdecec'
  critical-fill: '#dc2626'
  attention-ink: '#92400e'
  attention-tint: '#fbf0dc'
  attention-fill: '#b45309'
  good-ink: '#166534'
  good-tint: '#e6f4ea'
  good-fill: '#15803d'
  info-ink: '#1d4ed8'
  info-tint: '#e8effd'
  info-fill: '#2563eb'
  neutral-ink: '#48484a'
  neutral-tint: '#ececf0'
  neutral-fill: '#6e6e73'
typography:
  caption:
    {
      fontFamily: &stack '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, "Noto Sans Gujarati", sans-serif',
      fontSize: 12px,
      lineHeight: 1.5,
    }
  footnote: { fontFamily: *stack, fontSize: 14px, lineHeight: 1.5 }
  body: { fontFamily: *stack, fontSize: 16px, lineHeight: 1.5 }
  title3: { fontFamily: *stack, fontSize: 20px, lineHeight: 1.5 }
  title2: { fontFamily: *stack, fontSize: 24px, lineHeight: 1.5 }
  title1: { fontFamily: *stack, fontSize: 32px, lineHeight: 1.5 }
rounded:
  control: 12px
  card: 16px
  sheet: 20px
  chip: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  xxl: 32px
  target: 52px
  target-min: 44px
components:
  button-primary:
    backgroundColor: '{colors.accent}'
    textColor: '{colors.on-accent}'
    rounded: '{rounded.control}'
    height: '{spacing.target}'
  status-chip:
    backgroundColor: '{colors.neutral-tint}'
    textColor: '{colors.neutral-ink}'
    typography: '{typography.caption}'
    rounded: '{rounded.chip}'
    height: 28px
---

# Design System: Uptimo

This file is the design language of the product (D33), in impeccable's eight sections: overview, colors, typography,
layout, elevation and depth, shapes, components, do's and don'ts. The front matter holds **today's light
values**, and `apps/web/src/ui/tokens.css` keeps the numbers until ticket 81 adds a test that the two agree. Dark
values live in `tokens.css`. Where each value comes from:

- Colours, type sizes, radii (control, card, sheet), the 52 and 44 px targets and the line height come from
  `tokens.css`. `surface-2` is today's `neutral-50`.
- The spacing steps 4 to 32 and the 28 px chip height come from `docs/design/LOCK.md`. LOCK.md says only that chips
  are round. The 9999 px radius is defined in this document; `tokens.css` has no chip radius token, and the kit draws
  chips with the utility `rounded-full`.

Nimish's pick of a direction (packet 80s) may still change the tone values, `surface-2` and the chart palette.
Where a value is not known yet, the text says so.

## Overview

**Creative North Star: "Quiet when well".** This is the third principle of `PRODUCT.md`, used here as a working
name; Nimish has not named one. What is running is quiet. What is stopped, waiting or held up stands out. A screen
shows the next action, not the most data.

The interface follows Apple's three principles, Nimish's stated preference (`docs/BRIEF.md`).

- **Clarity.** Text is legible at every size, icons are precise, and the one thing a screen is for is obvious at
  a glance.
- **Deference.** The interface steps back so the content leads. No decoration that does not help someone act or
  understand.
- **Depth.** Layers and motion explain where you are and what just happened. They are never there for show.

**Two zones, by route.** The two zones differ in how much may change (D33 §3).

- `/floor/*` and `/desk/*` (the list, the ticket, the board and the TV) keep the incumbent app's (v3) flow,
  screen order, button positions and words (`docs/design/LOCK.md` rule 1, D33 §3). Only colour, type, depth and
  motion change.
- Settings has no v3 view to check against (ticket 88). Its existing screens keep their current flow and words in
  the restyle.
- `/analytics/*` (Today, the analyses and the machine page) is redesigned freely. Its figures stay exact.

**Operate mode.** Use impeccable's Operate and Read modes (precision and restraint) and not its bolder modes,
unless Nimish asks. One accent colour for actions. One primary action per screen; secondary actions look
secondary. Every screen shows a visible focus state, works at phone width and passes an accessibility check.
Space is generous: when in doubt, fewer items per screen.

**The bar for a screen.** `impeccable critique` scores at least 32 of 40 with 0 P0 findings, axe reports 0
violations, and the 360 px layout is built first (ticket 85).

### Settled by Nimish (19 Nov 2026, D33)

- **Running is grey.** Stopped, waiting and transferred stand out; running is quiet. Green stays for fixed,
  confirmed and target met.
- **Waiting is amber** (attention) **and Transferred is blue** (info). Each keeps its icon and its word. The old
  orange and violet are retired on the floor, the desk and analytics.
- **Numbers use Indian grouping**, 1,00,000. Money keeps the form it prints today, "₹ 38.23 lakh".
- **Analytics follows the device's light or dark setting.** The TV board is always dark.
- **The TV is 50 inch or larger.** The distance from the readers is not known yet; the design target is readable
  from 3 m (`PRODUCT.md`).

## Colors

One teal accent, a neutral ground, and five tones that mean something. Colour never carries meaning alone: every
status is colour, icon and word.

### Neutral and accent roles

Ten roles, each with a light and a dark value in `tokens.css`.

- **page**, **surface**, **surface-2**: the three grounds. Surface-2 is a second ground step for panels (light
  `#fafafa`, dark `#151517`, today's `neutral-50`); the pick may change it.
- **line**: card edges and dividers. **control**: the border of anything you tap or type in, 3.26:1 on white.
- **ink** and **ink-2**: primary and secondary text.
- **accent** is also the focus ring. **on-accent** is the text on an accent fill. **accent-tint** is the soft fill
  behind a tonal button. Light accent `#0f766e` is 5.47:1 on white; dark accent is `#14b8a6`.

### Tone grammar

Five tones: **critical**, **attention**, **good**, **info** and **neutral**. Each has three roles.

- **ink**: the text and icon on a tint. **tint**: the soft background of a chip or banner. **fill**: a bar, a heat
  cell, a 3 px edge or a dot.
- A chip is tint, ink, icon and word. **A fill never carries text.** At most one critical fill per card.
- Today's tones map in: danger is critical, warning and hold are attention, ok is good, info and moved are
  info, muted is neutral. Today's amber is two tones. Warning has fill `#b45309` (`--color-warning`) and ink `#92400e`; hold has fill
  `#c2410c` (`--color-hold`) and ink `#9a3412`. The front matter uses the warning pair; which pair the pick keeps
  is not known yet.

### The status map

One rule maps all 40 statuses (ticket 82 holds the table). Danger goes to critical. Warning and hold go to
attention. Info and moved go to info. Ok goes to good, **except `ticket.running`, which goes to neutral**. Muted
goes to neutral. So Running is grey, Waiting is amber, Transferred is blue and Fixed is green.

Distinct statuses now share a colour (S2 and S3, Waiting and Support, In progress and Transferred, Offline
and Draft). The icon and the word tell them apart. If people confuse a pair, ticket 82 gives one pair a second tone.

### Contrast rule

Every text is 4.5:1 and every mark or border is 3.0:1 against every background it is drawn on: page, surface,
surface-2 and its own tint. A tone's ink is also checked on its tint. Ticket 81 turns this into a test.

### Direction of good

A figure has a direction: up is good, down is good, or neither. A change takes its tone from that direction and
not from the arrow. Ticket 82 holds the direction for each of the 51 figures; a percentage always prints `%`.

### Chart colours

- **Categorical:** 8 series, `series-1`, `series-2`, `series-3`, `series-4`, `series-5`, `series-6`, `series-7` and `series-8` (the tokens `--color-series-N` in `tokens.css`; the chart door draws slots 1 and 2 from `--color-chart-1` (the accent) and `--color-chart-2` (the neutral) first and slots 3 to 8 from `--color-series-3` to `--color-series-8`; the same values in `ui/chart-palette.ts`; `tokens.test` keeps them in step), as a new palette built from the approved showcase's hue bands (not the showcase's own series, which differ). Never a status value, and never in the red (345 to 50 degrees), green
  (90 to 160) or info-blue (205 to 235) hue bands, so a series is never mistaken for a status.
- **Ramps:** one sequential (`seq`) and one diverging (`div`) ramp of 5 steps. A ramp cell carries a computed black or white label
  at 4.5:1.
- Every series is named by a legend or an end label, because separation for a colour-vision difference is weak
  (minimum deuteranopia distance 11.2 for the 8 in the light theme, measured in `tokens.test.ts`; the earlier
  showcase series measured 3.2, `docs/slices/80-design-foundations.md` R11).

## Typography

**Font:** the system stack, `-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, 'Noto Sans Gujarati',
sans-serif`. No webfont is loaded; it would be a dependency in all but name. Whether figures and headings take a
named system serif is part of the pick and is not known yet.

**Gujarati.** The floor reads Gujarati, so it falls back to the device's face. Noto Sans Gujarati covers Android
and the CI image. Windows uses Nirmala UI and macOS Gujarati Sangam MN (inferred, not checked on a device).

### Hierarchy

- **Caption** (12 px): chips.
- **Footnote** (14 px): hints and secondary lines.
- **Body** (16 px): the default.
- **Title3** (20 px): the bar title and the machine row.
- **Title2** (24 px): the step question and counts.
- **Title1** (32 px): the card's machine code.
- **Analytics tile value:** 28, 32 or 40 px; the pick decides (not known yet).
- **TV, six sizes only:** 40, 48, 64, 80, 120 and 160 px. 160 is the hero number. They are used on the board only.

Weights are 400, 600, 700 and 800. Which weight each size takes is not known yet; the kit's components set it.

### Named rules

**The Leading Rule.** English lines use 1.5. Gujarati lines use 1.55 because matras sit above and below
(`:root[lang='gu']`).

**The Figures Rule.** Numbers use tabular figures, so a column of figures lines up. Grouping is Indian,
`en-IN`: 1,00,000 and "10,00,000".

**The Long Label Rule.** A 40-character Gujarati label wraps to two lines, then ends in an ellipsis with the full
text shown on focus. It never clips and never scrolls the page sideways.

## Layout

One column on a phone and a grid on a laptop, with the same words and order in the two zones.

- **Breakpoints:** 360, 768, 1024 and 1440 px. The TV is 1920 px wide. Build at 360 first.
- **Spacing:** 4, 8, 12, 16, 24, 32. Gutter 16, card padding 16, 16 between groups, 8 inside them.
- **Tap targets:** 52 px for primary actions and fields, 44 px as the floor for anything smaller.

### Density tiers

- **Phone.** One column, 2 tiles a row, 16 px gutter, 44 and 52 px targets, 10 rows before "more". One thumb, a
  shared low-end Android.
- **Laptop.** 12 columns, 4 to 6 tiles a row, 36 px rows for a pointer only, 50 rows a page. A wide screen
  from 1024 px shows a list and its detail side by side on the desk.
- **TV.** Read at 3 m, no pointer, no money, always dark, from 1920 px. Three machines per column plus "and N more".

### Templates

Five templates carry every analytics screen: **overview**, **analysis**, **register**, **entity** and **work
queue** (ticket 85). Nimish approves one mockup per template, not one per screen (D33 §4). Each template's regions
by tier are not known yet; its approved mockup sets them. Also shared across screens:

- **Grouped navigation:** the 8 analytics groups.
- **Drill trail:** where you are in a drill-down.
- **Period picker:** the time range of every figure.

### The two-zone rule

The floor and the desk may change colour, type, depth and motion. They never change order, position or words. The
analytics screens may change all four and their layout, and their figures stay exact.

**How ticket 89 measures "the same third".** At 360 by 740 px, for each control in a v3-to-ours mapping table, the
DOM order index and `floor(centreY / (740 / 3))` must be equal. Ticket 88 measures the desk the same way at 360 by
740 and 1440 by 900.

**Capturing v3.** Playwright opens `docs/discovery/bhavin-v3/maint.html` from disk with every network request
blocked and a planted fictional client (`localStorage['bd_cfg_demo']` holding an invented plant, machines and
people, opened with `?c=demo`). It saves one PNG and one JSON of control boxes per step to
`docs/design/evidence/bhavin-v3/`. Every name on screen is invented, so no real personal data is captured.

## Elevation & Depth

Three levels, in light and dark. Depth says where you are and what is on top (Apple's third principle); it is never
decoration. The values below are today's (`tokens.css`); the pick (packet 80s) may change them.

- **Level 0, page.** The ground (page, and surface-2 as a second step). No shadow.
- **Level 1, raised.** A card or panel resting on the page. Light: `0 1px 2px rgb(0 0 0 / 0.06), 0 1px 3px
rgb(0 0 0 / 0.1)`. Dark: a 1 px hairline, `0 0 0 1px #2c2c2e`, with no blur (LOCK.md: light cards carry one soft
  shadow, dark cards a hairline).
- **Level 2, overlay.** A sheet or side panel over a scrim. Light: `0 -8px 24px rgb(0 0 0 / 0.16)`. Dark: the same
  with 0.5 opacity. `BottomSheet`, the page search and the drawer on a narrow screen lay one scrim (`--color-v2-scrim`) behind them.

**The No-Nesting Rule.** No level 1 inside level 1. A tile on a card is a flat region (a `line` rule or surface-2),
never a second raised card. Today the card's shadow is written by hand 57 times (slice 80, section A); ticket 82 makes
it one element.

**The TV Rule.** The TV uses levels 0 and 1 only. It has no pointer and nothing opens on it, so it has no overlay.

## Shapes

Radius per role. A round chip is the only full radius; everything else has a corner.

| Role    | Radius          | Where                                                                                             |
| ------- | --------------- | ------------------------------------------------------------------------------------------------- |
| control | 12 px           | Buttons and banners (`rounded-xl`)                                                                |
| card    | 16 px           | Cards and the loading tile (`rounded-2xl`)                                                        |
| sheet   | 20 px           | The top corners of a sheet (`--radius-sheet`)                                                     |
| chip    | 9999 px (round) | Status chips and badges; defined here, see the top of this file                                   |
| tile    | 16 px           | The KPI tile is a card today; whether it takes its own radius is part of the pick (not known yet) |

Buttons in the v2 kit draw at 10 px (`v2.css`) and fields at 9 px (`date-field.css`).

- **Border or shadow.** A card is lifted by level 1 and has no border of its own. A field and an unfilled button
  (the secondary variant) have a 1 px `control` border, because they must be found; filled and text-only buttons
  (primary, tonal, quiet) have none. `control` is 3.26:1 on white (the surface) and 2.99:1 on the light page
  (`#f5f5f7`), just under the 3.0 rule; in dark it is 5.22:1 on the surface and 5.75:1 on the page. Whether the light
  value changes is not known yet; the pick may change it. Dividers and anything that only separates use `line`.
- **Tables.** Laptop rows are 36 px for a pointer only, and a row you tap is at least 44 px. 50 rows a page on a
  laptop, 10 before "more" on a phone, and figures are tabular. How a row is ruled, whether the header sticks and the
  column rules are not known yet. Ticket 83 builds the data table and its mockup sets them.
- **Focus ring.** 2 px in the accent colour, offset 2 px (`:focus-visible` in `style.css`). It follows the 3.0 rule
  for marks on every ground it is drawn on. Every control shows it.

## Components

The kit is the v2 kit: `apps/web/src/ui/v2/` (general parts) and `apps/web/src/ui/v2/domain/` (maintenance parts).
Every screen lives under `screens/v2/` and composes only these parts; `pnpm ui:check` fails a screen that draws its
own colours, sizes, weights or motion, and `tools/old-ui-left.test.ts` fails if an old-design `.tsx` comes back
anywhere under `apps/web/src`. Logic that the kit reads (`patterns/view-state.ts`, `patterns/crud-spec.ts`,
`ui/status/*.ts`, `ui/meaning/`) stays where it is (ADR 0051); it draws nothing.

- **The catalogue.** [`docs/design/v2/KIT.md`](design/v2/KIT.md) lists every part: its file, what it is for, when to
  pick it over its neighbours, its key props and the screens that use it. The dev gallery's index (`/gallery`) lists
  the same parts and links every screen view (`/gallery?view=v2-<name>`).
- **The rules.** [`docs/design/v2/LANGUAGE.md`](design/v2/LANGUAGE.md) (look, behaviour, the screen recipe and "which
  kit part to reach for") and `docs/design/v2/UX-RULES.md` (how information behaves). Where this file and those two
  disagree on a v2 screen, they win.

The groups, in the order KIT.md uses:

1. **Foundations.** The `--*-v2-*` tokens in `ui/tokens.css` (light and dark), `v2.css`, the self-hosted fonts
   (Inter, Geist, Geist Mono), `motion.ts` + `motion.css`, `format.ts` (Indian grouping, lakh and crore) and `Icon`
   (`icons.tsx`).
2. **Layout.** `Shell` and, for every screen, `EntityShell` (`screens/v2/entity/EntityShell.tsx`), whose drawer is
   driven by `?drawer=` in the URL so Back closes it; `Drawer`, `Panel`, `Row`, `SectionHead`, and `BottomSheet` for
   pages outside the Shell.
3. **Data display.** `KpiCard`, `FigureTile`, `TileSet`, `Sparkline`, `TrendChart`, `ChartCard`, `ChartNumbers`,
   `Pareto`, `BulletBar`, `RankedBars`, `Quadrant`, `BubblePlot`, `EventStrip`, `DataTable`, `PagedTable`, `Verdict`,
   `Points`, `Takeaway`, `KeyPill`, `StatusPill`, `EntityChip`, `ReasonChips`, `SeverityRow`, `ReviewMarker`.
4. **Inputs and forms.** `Button`, `Segmented`, `PeriodToggle`, `SelectField`, `DateField`, `FormSheet`, `Wizard`,
   `CrudPage` with `crud-actions` (bulk actions) and `crud-model`, `MoreToggle`, `WhyToggle`, `ShowDetail`,
   `DrillButton`, `DrillAction`, `DownloadExcel`, `TickRow`, the close parts (`close-kit.tsx`), `AccountSheet` and
   `DraftsList`.
5. **Feedback and states.** `ScreenStates` (skeleton, error, offline, empty and the rest), `Banner`, `Notice`,
   `UpdateBanner`, `SyncStatus`, `AlertsCard`, `ActionStrips`.
6. **Domain pieces.** `floor-kit.tsx` (the floor's rows, tiles and fields) and `domain/`: the entity details
   (`MachineDetail`, `CellDetail`, `PersonDetail`, `DecisionDetail`), `RowsBehind`, `DecisionList`/`DecisionRow`,
   `EngineTable`, `PrintedDataTable`, `HeatMatrix`, `HeatTiles`, `MonthCalendar`, `CompareBox`, `FactList`,
   `PlantMap`, `MachineTable`, and the forms `AckForm`, `CorrectDate`, `WhyForm`.

A part a screen needs and the kit lacks is added to the kit (with its KIT.md entry and its gallery line), never drawn in
the screen.

### Where the first analytics elements went

The twelve elements ticket 83 named are all v2 kit parts now; the old `ui/elements` versions are deleted.

| Element            | v2 part                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------- |
| KPI tile           | `KpiCard` (below), `FigureTile` for a figure with no change to compare                      |
| Status chip        | `StatusPill` for a state, `KeyPill` for a key pointer                                       |
| Sparkline          | `Sparkline`                                                                                 |
| Trend delta        | The change line inside `KpiCard`                                                            |
| Heat grid          | `HeatMatrix` (two dimensions) and `HeatTiles`                                               |
| Ranked list        | `RankedBars`, or `Pareto` for where the hours go                                            |
| Timeline           | The ticket page's history (`screens/v2/ticket`); `EventStrip` for 90 days of events         |
| Insight banner     | `Verdict` and `Takeaway` (the answer first); `Banner` and `Notice` for messages             |
| Data table         | `DataTable` (rows in the browser), `PagedTable` and `EngineTable` (paged or printed)        |
| Period picker      | `PeriodToggle`, or `Segmented` for any short choice                                         |
| Grouped navigation | The `Shell` rail                                                                            |
| Drill trail        | The drawer's place in the URL (`?drawer=`): Back steps out of a drill, so no trail is drawn |

### The KPI card in full

- **Anatomy.** `KpiCard`: a label, the value as the engine printed it (Geist, 24 px), its change against the last
  period, one line of meaning, an optional sparkline, and with `drill` a control that opens the rows behind the figure
  in the drawer.
- **Tone.** The change takes its tone from the figure's direction of good (down is good for downtime), never from the
  sign, and always with a word or an arrow beside the colour. A missing value prints "—", never 0.
- **Tier.** `Row` puts 2 to 4 cards side by side on a laptop; on a phone they stack. `TileSet` folds past four and
  collapses to one line when every figure is zero.

### Empty, loading and error

`useScreenModel` returns `loading`, `ready`, `error` or `empty`, and `ScreenStates` draws each: a skeleton in the
screen's own layout, an error with "Try again", the empty line, and the offline, refused and not-computed states.
`viewState` (`patterns/view-state.ts`) is the logic behind the floor's and the forms' states. Cached data still shows
when the network is down, so offline is shown only when there is nothing to show. A `not_found` answer is empty, not
an error. Retry is the only state with a button.

### Charts

Every chart goes through the one chart door (`ui/chart/use-chart.ts`, drawn by `ui/chart/chart.tsx`) or a kit part
built on it (`TrendChart`, `ChartCard`).

- **Choose the form.** A KPI card for one current value. A trend (line) for 6 or more periods. Bars for 12 categories
  or fewer. `RankedBars` or `Pareto` for more. `HeatMatrix` for two dimensions. `Quadrant` for two measures.
- **The numbers.** The table is always there, behind "Show the numbers" (`ChartNumbers`).
- **Touch.** A tooltip on a pointer and a tap on a phone. Bars start at zero. Charts are `role="img"` with a sentence.
- **Colour.** Meaning colours and machine type colours only (`--color-v2-*`), never decoration.

### Icons

`Icon` from `ui/v2/icons.tsx`: one stroke weight (1.8 on a 24 grid), sized to the text beside it, drawn in the text's
colour and always decoration beside a word or inside a named control. A missing icon is added there, drawn the same
way. Lucide (`ui/icon.ts`) is imported only there (`tools/check-ui.ts`); a few parts still use it
(`account-sheet.tsx`, `floor-kit.tsx`, `alerts-card.tsx`) and two screens (`floor/View.tsx`, `settings-plant/plant-specs.tsx`) until their icons are drawn in `icons.tsx`.

### Motion

Only from `ui/v2/motion.ts` and `motion.css`, and only to show what changed: figures tick up on first load and between
values, charts draw in once, a changed value flashes its direction once, rows re-flow after a filter or sort, the
drawer slides in, buttons press to 0.97, a down machine pulses three times. UI motion takes 160 to 240 ms and data
motion 500 to 800 ms on one ease-out curve (`--motion-v2-*`), so UI feedback never runs past 300 ms. The older
`--motion-fast` (150 ms) and `--motion-slow` (250 ms) tokens are still in `tokens.css`, and no kit part uses them.
Nothing fades in because a page loaded. Under reduced motion all of it is instant.

### Numbers

- **Grouping.** `en-IN`: 1,00,000 and 10,00,000 (Nimish, 19 Nov), through `format.ts`.
- **Money.** The form it prints today, "₹ 38.23 lakh". Never on the TV.
- **Percentage and unit.** A percentage always prints `%`. A figure with a unit prints it.
- **Missing.** "—", never a blank or 0.
- **As printed.** A screen prints the engine's number; a number beside it only places a mark or sorts a column.

## Do's and Don'ts

The floor and desk come first, because they are where a change costs most.

### Don't

- **Don't** move, reorder or reword anything on `/floor/*` or `/desk/*`. Only colour, type, depth and motion change.
- **Don't** use `className`, a raw colour or a hand-made element in `faces/`. Build from the kit.
- **Don't** let colour carry meaning alone. Every status is colour, icon and word.
- **Don't** put text on a fill, or draw more than one critical fill on a card.
- **Don't** colour Running green, and don't bring back the old orange (waiting) or violet (transferred).
- **Don't** give a chart series a status colour, or a hue in the red, green or info-blue bands.
- **Don't** nest a raised card in a raised card, or give the TV an overlay.
- **Don't** animate a floor or desk figure or row, run a movement past 300 ms on floor and desk, or past 800 ms in the analytics elements.
- **Don't** print a percentage without `%`, or group a number in thousands (1,000,000).
- **Don't** show money on the TV.
- **Don't** load a webfont; it would be a dependency in all but name.
- **Don't** use impeccable's bolder modes unless Nimish asks.
- **Don't** write a value nobody has given. Write "not known yet".

### Do

- **Do** keep the v3 flow, order, button positions and words on the floor and desk.
- **Do** take a status's tone from the status map, and let no screen choose its own.
- **Do** check every text at 4.5:1 and every mark at 3.0:1 on every ground.
- **Do** build the 360 px layout first, with 52 px targets for primary actions and 44 px as the floor.
- **Do** keep one accent colour and one primary action on a screen.
- **Do** put "Show the numbers" behind every chart.

### Corrections

`learn-taste` adds Nimish's later corrections here, dated, under the heading they belong to. None yet.
