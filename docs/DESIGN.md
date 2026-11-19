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

This file is the design language of the product (D33). Sections 1 to 4 are here; sections 5 to 8
(depth, shapes, components, do's and don'ts) follow in packet 80d. The front matter holds **today's light
values**, and `apps/web/src/ui/tokens.css` keeps the numbers until ticket 81 adds a test that the two agree. Dark
values live in `tokens.css`. Where each value comes from:

- Colours, type sizes, radii (control, card, sheet), the 52 and 44 px targets and the line height come from
  `tokens.css`. `surface-2` is today's `neutral-50`.
- The round chip (9999 px), the spacing steps 4 to 32 and the 28 px chip height come from `docs/design/LOCK.md`.

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

- **Categorical:** 8 series, `series-1`, `series-2`, `series-3`, `series-4`, `series-5`, `series-6`, `series-7` and `series-8`, per direction. Never a status value, and never in the red (345 to 50 degrees), green
  (90 to 160) or info-blue (205 to 235) hue bands, so a series is never mistaken for a status.
- **Ramps:** one sequential (`seq`) and one diverging (`div`) ramp of 5 steps. A ramp cell carries a computed black or white label
  at 4.5:1.
- Every series is named by a legend or an end label, because separation for a colour-vision difference is weak
  (minimum deuteranopia distance 3.2 for the 8, `docs/slices/80-design-foundations.md` R11).

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

Sections 5 to 8 follow in packet 80d.
