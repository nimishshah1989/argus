# D4 — One kit, one icon set, the tokens and the status vocabulary

Date: 13 November 2026 · Status: accepted (architect); detail in `docs/ARCHITECTURE.md`

## Decision

Components are copied once from shadcn/ui (on Radix primitives) into `apps/web/src/ui/`; icons are Lucide, imported only in `ui/icon.ts`. All three are **verify in current docs** (Tailwind 4 and React 19 support) and the install PR lists every package in `THIRD_PARTY.md`. White surfaces and the system font follow `docs/DESIGN.md`. **The accent colour is an open choice for Nimish** (made on the `/gallery`); until he chooses, the token keeps the built value `#0a66c2`.

## Tokens (`ui/tokens.css`)

| Group          | Values                                                                                                                                                                                                                                                    |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accent         | Deep teal `--color-accent: #0f766e` (decided 13 Nov 2026; 5.5:1 on white, so text, fills and rings). Blue `#0a66c2` is the gallery comparison (D20).                                                                                                      |
| Surfaces       | background `#ffffff`; neutrals as in `style.css` today: `#fafafa`, `#f5f5f7`, `#e8e8ed`, `#d2d2d7`, `#aeaeb2`, `#8e8e93`, `#6e6e73`, `#48484a`, `#3a3a3c`, `#1d1d1f`                                                                                      |
| Status colours | danger `#dc2626`; info `#2563eb`; warning `#b45309`; hold `#c2410c`; moved `#7c3aed`; ok `#15803d`; muted `#6e6e73`                                                                                                                                       |
| Type           | `-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif`; Noto Sans Gujarati only as the Gujarati glyph fallback and in PDFs (packaging: verify). Scale 12, 14, 16, 20, 24, 32 px; floor body 18–26 px; tabular numerals for times and KPIs |
| Space          | 4, 8, 12, 16, 24, 32, 48 px                                                                                                                                                                                                                               |
| Radius         | 8, 12, 16 px; one shadow scale                                                                                                                                                                                                                            |
| Motion         | 150 ms and 250 ms; off under `prefers-reduced-motion`                                                                                                                                                                                                     |
| Targets        | 52 px minimum height on floor and desk; 8 px minimum gap                                                                                                                                                                                                  |

Contrast caution: white text on `#0d9488` is, by my calculation, about 3.7:1, below the 4.5:1 WCAG AA needs for normal-size text. It is acceptable for large text, icons and large buttons (3:1). The gallery's axe run decides; where it fails, the component uses `--color-accent-strong`. Every status colour is measured the same way.

## Status vocabulary (`ui/status/<group>.ts`)

Colour never carries meaning alone: every status has a label and an icon. Lucide icon names are **verify in current docs**.

| Group    | Status id     | Colour token | Icon               | Label key                   |
| -------- | ------------- | ------------ | ------------------ | --------------------------- |
| ticket   | `stopped`     | danger       | `octagon-x`        | `status.ticket.stopped`     |
| ticket   | `in_progress` | info         | `wrench`           | `status.ticket.inProgress`  |
| ticket   | `support`     | warning      | `life-buoy`        | `status.ticket.support`     |
| ticket   | `waiting`     | hold         | `hourglass`        | `status.ticket.waiting`     |
| ticket   | `transferred` | moved        | `arrow-right-left` | `status.ticket.transferred` |
| ticket   | `running`     | muted        | `circle-check`     | `status.ticket.running`     |
| ticket   | `closed`      | muted        | `check-check`      | `status.ticket.closed`      |
| ticket   | `cancelled`   | muted        | `ban`              | `status.ticket.cancelled`   |
| severity | `S1`          | danger       | `chevrons-up`      | `status.severity.s1`        |
| severity | `S2`          | hold         | `chevron-up`       | `status.severity.s2`        |
| severity | `S3`          | warning      | `minus`            | `status.severity.s3`        |
| severity | `S4`          | muted        | `chevron-down`     | `status.severity.s4`        |
| clock    | `ok`          | muted        | `clock`            | `status.clock.ok`           |
| clock    | `due_soon`    | warning      | `alarm-clock`      | `status.clock.dueSoon`      |
| clock    | `overdue`     | danger       | `triangle-alert`   | `status.clock.overdue`      |
| clock    | `paused`      | hold         | `pause`            | `status.clock.paused`       |
| clock    | `stopped`     | muted        | `circle-stop`      | `status.clock.stopped`      |
| handback | `requested`   | info         | `circle-help`      | `status.handback.requested` |
| handback | `confirmed`   | ok           | `thumbs-up`        | `status.handback.confirmed` |
| handback | `disputed`    | danger       | `thumbs-down`      | `status.handback.disputed`  |
| handback | `timed_out`   | muted        | `timer-off`        | `status.handback.timedOut`  |
| pm       | `due`         | warning      | `calendar-clock`   | `status.pm.due`             |
| pm       | `overdue`     | danger       | `calendar-x`       | `status.pm.overdue`         |
| pm       | `done`        | ok           | `calendar-check`   | `status.pm.done`            |
| forecast | `hot`         | danger       | `flame`            | `status.forecast.hot`       |
| forecast | `watch`       | warning      | `eye`              | `status.forecast.watch`     |
| forecast | `normal`      | muted        | `shield-check`     | `status.forecast.normal`    |
| sync     | `online`      | muted        | `wifi`             | `status.sync.online`        |
| sync     | `offline`     | hold         | `wifi-off`         | `status.sync.offline`       |
| sync     | `sending`     | info         | `refresh-cw`       | `status.sync.sending`       |
| sync     | `draft`       | warning      | `file-pen`         | `status.sync.draft`         |

The forecast band names follow Bhavin's platform once the M4a triage confirms them; the ids above are placeholders for that group only.

## Why

BRIEF "Design language": one kit, one icon set, a fixed status vocabulary, no hand-styled elements.

## Rejected

- A second kit, hand-styling, mixed icon sets.
- Green for "running": the existing meaning users read is neutral (SPEC §7); green is kept for a confirmed result.
