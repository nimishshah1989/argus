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
  with 0.5 opacity. **Today** the scrim is `neutral-900` at 40 % (`ui/sheet.tsx`); in dark `neutral-900` is `#f5f5f7`, so
  the scrim lightens the backdrop there. **Target:** a black scrim at 40 % in both themes; the token `--color-scrim` (`bg-scrim`) is that scrim and only `DrillPanel` uses it so far, `ui/sheet.tsx` keeps its own until the gallery baselines are regenerated. The code does not change in
  this packet.

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

Fields draw at 8 px today (`ui/input.tsx`). Whether they move to the control radius is not known yet.

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

The kit is `ui/` and `patterns/`. Today it holds Button (primary, secondary, tonal, quiet, quiet-danger), Input,
Card, Sheet, StatusPill, TopBar, TabBar, Banner, Skeleton, CountsStrip, SegmentedBar and TicketCard (LOCK.md). Ticket
83 adds the 13 elements below, each with a gallery section at 360 and 1440 px in light and dark. Each must pass
`break-ui`: a 40-character Gujarati label, a 7-digit number and 0 items, with every tap target at least 44 px.
Anatomy, states and sizes per tier are written here as each element is built; where nothing is decided the line says so.

1. **KPI tile.** One current value (see the tile in full below).
2. **Status chip.** Tint, ink, icon and word; 12 px caption, 28 px high, not tappable. A tappable filter chip is 44 px.
3. **Sparkline.** Anatomy, size and whether a tile carries one are not known yet.
4. **Trend delta.** Arrow icon, the change with `%` or its unit, and a tone from the direction of good, not the arrow.
5. **Heat grid.** Two dimensions. Cells are fills from the ramp, so the label is a computed black or white at 4.5:1.
6. **Ranked list.** The form for more than 12 categories; bars start at zero.
7. **Timeline.** A ticket's history. Its anatomy is not known yet.
8. **Insight banner.** The kit Banner: info, attention, error, muted or ok tone, a 20 px icon and a word.
9. **Empty, loading and error states.** The next subsection.
10. **Data table.** Pages, sorts and filters; no list paints more than 50 rows first, and a list that can pass 200
    rows pages on the server.
11. **Period picker.** The time range of every figure.
12. **Grouped navigation.** The 8 analytics groups (Guide is the eighth), collapsed except the current one, and the Data checklist at the foot.
13. **Drill trail.** Where you are in a drill-down.

### The KPI tile in full

- **Anatomy.** A translated label, the value with its unit, a trend delta, and the mark that says where a tap drills.
  The tile is a card (level 1) and a tap on it goes to its drill target, so it is at least 44 px high.
- **Value size.** 28, 32 or 40 px, as the pick decides (not known yet). On the TV it takes one of the six TV sizes.
- **Tone.** The delta takes its tone from the direction of good, and so does the edge unless the tile has a family:
  then the edge and the trend line are the family's identity colour and the delta and chip keep the tone. One critical
  fill per card, and a fill never carries text. A tile that drills shows a chevron at its top right and darkens while
  pressed.
- **Tier.** Phone: 2 tiles a row. Laptop: 4 to 6. TV: scoreboard tiles, no money.
- **States.** Ready, empty, loading, error and offline, as below. A missing value prints "—", never 0.

### Empty, loading and error

Every element and every template has all three. `viewState` (`patterns/view-state.ts`) picks one of five: ready,
empty, loading, error or offline. Cached data still shows when the network is down, so offline is shown only when
there is nothing to show. A `not_found` answer is empty, not an error. `StateNotice` (`patterns/frame.tsx`) draws them.

- **Loading.** Skeletons in the screen's own layout (title, line, short, row, tile), then "Loading…" with
  `role="status"` from `common.loading`. The skeleton pulses unless motion is reduced.
- **Empty.** One body line in `ink-2`, written and translated by the screen that owns the list, with no button.
- **Offline.** One body line in `ink-2` with `role="status"`, from `kit.pattern.offline`.
- **Error.** A body title in `ink` with `role="alert"` (`kit.pattern.error`) and a secondary Retry button
  (`kit.pattern.retry`). Retry is the only state with a button.

What each new element shows in these three states is not known yet; ticket 83 draws them in each gallery section.

### Charts

These are the rules ticket 84 builds to. Today the one chart door (`ui/chart/use-chart.ts`) draws bar, line, scatter
and mixed charts with at most two series, no legend and no animation unless a spec asks for `draw`: then it draws in
once over 700 ms, never again on a data update and never under reduced motion (D27, which D33 amends).

- **Choose the form.** A tile for one current value. A trend (line) for 6 or more periods. A bar for 12 categories or
  fewer. A ranked list or Pareto for more. A heatmap for two dimensions.
- **The numbers.** The table is always there, behind "Show the numbers".
- **Legend.** A legend from 2 series up; a line's end labels count as its legend.
- **Touch.** A tooltip on a pointer and a tap on a phone. Bars start at zero.
- **Colour.** From the chart palette in Colors, never a status value.

### Icons

Lucide, imported only through `ui/icon.ts` (D04; `tools/check-ui.ts` fails Lucide anywhere else). The target is three
sizes, 16, 20 and 24 px, with stroke 2.

**Today** the kit draws 14 px (`patterns/queue-table.tsx`), 16, 18 (`patterns/form-sheet.tsx`, `ui/filter-chip.tsx`),
20 and 22 px (`ui/tab-bar.tsx`, `ui/floor-pieces.tsx`), and the ticks in `ui/filter-chip.tsx` and `ui/tick-row.tsx`
use stroke 3. Which of the three sizes each moves to, and whether a tick keeps stroke 3, is not known yet. A status
icon always sits beside its word.

### Motion

Motion shows what changed and what is new (Nimish, 19 Nov: the analytics showcase wins). Loading skeletons may loop;
all other motion runs once and is purposeful. Reduced motion switches all of it off.

- **Two zones.** The analytics elements (`ui/elements`, `ui/elements/elements.css`, `motion.ts`) move as below. The
  floor and the desk stay locked to v3: they gain no motion beyond colour, type, depth and what they already have
  (below).
- **Built in the analytics elements (tickets 83 and 83b).** A figure counts up from zero over 600 ms (ease-out) when it
  first appears and eases from the old value to the new one when it changes (`useCountUp`); heat-grid squares pop in
  over 460 ms, staggered 32 ms per column; a sparkline is revealed left to right over 800 ms; a table or list cross-fades over 200 ms
  when its filter, sort or page changes; a drill panel (`DrillPanel`) slides in from the right over 320 ms and out over 200 ms (its scrim fades over 200 ms each way); a chart
  drawn through the chart door with `draw: true` (bar, line, Pareto) draws in once over 700 ms.
- **Opt in.** A chart that does not ask for `draw` stays still; a screen opts in per chart.
- **UI feedback** stays at `--motion-fast` 150 ms and `--motion-slow` 250 ms. Nothing on floor or desk runs past 300 ms.

- **What moves, today, on floor and desk.** The sheet and its scrim (250 ms, `ui/sheet.tsx`), the pressed colour of a
  floor tile (150 ms, `ui/floor-pieces.tsx`), and the skeleton, which pulses until content arrives. Floor rows never
  animate in or reorder, and floor and desk figures never count up.
- **Reduced motion.** Changes are instant: a figure shows its final value, squares and lines appear drawn, lists do not
  fade, the skeleton holds still, and charts draw with no animation, also if reduced motion is asked for while one is on screen. The browser test `elements.spec.ts` checks that
  the heat-grid pop and the drill-panel slide are off under reduced motion and on otherwise, and `chart-option.test.ts` checks that a chart's draw-in is off under reduced motion.
- **Tone.** A KPI tile's chip and delta take their tone from the figure's direction of good (down is good for
  downtime), not from the sign of the change, and a tone is only drawn where an icon and a word say it too. With a
  `family` (availability, downtime, repairs, planned), the tile's edge and trend line wear the family's identity
  colour instead (`--color-family-*`); a family says what a figure is, never whether it is good, so it never replaces
  the tone's icon and word. A heat grid of one family shades in that family's five-step ramp
  (`--color-family-<name>-ramp-1..5`, ink 4.5:1, checked by `tokens.test.ts`). The family hues are an exempt identity
  palette (Colors bans status hues for chart series; these are not series) used only as a 4 px edge, a sparkline
  stroke, a panel's top edge and a heat ramp. Repairs shares the info blue with Transferred and downtime sits near the
  red and amber bands, so a family colour is never read as a status: it never appears without the figure's own
  label, and a status is always an icon and a word (Transferred is a chip with the word), never an edge colour alone.

### Numbers

- **Grouping.** `en-IN`: 1,00,000 and 10,00,000 (Nimish, 19 Nov). Figures print with `en-GB` today
  (`figure-content.ts`). Which ticket moves them to `en-IN` is not known yet.
- **Money.** The form it prints today, "₹ 38.23 lakh". Never on the TV.
- **Percentage and unit.** A percentage always prints `%`. A figure with a unit prints it.
- **Missing.** "—", never a blank or 0.
- **Gujarati digits.** Whether Gujarati screens print Gujarati digits is not known yet.

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
