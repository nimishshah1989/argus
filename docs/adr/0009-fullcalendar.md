# 0009 — The PM calendar uses FullCalendar 7.1.5, lazily loaded

Date: 19 November 2026
Status: accepted (planner, after the prototype below; the implementation packet proves the chunk condition)

## Context

Ticket 50 puts a PM calendar on the analytics face: a month grid of each machine's next PM, a daily load, and a
drag that reschedules the job (`docs/plan/MILESTONES.md:440-445`). SPEC §5a already names the library — "FullCalendar
standard plugins (MIT) for the PM calendar" (`docs/spec/SPEC.md:186`), repeated in ARCHITECTURE §5
(`docs/ARCHITECTURE.md:170`) — and `THIRD_PARTY.md:30` lists it as planned. No ADR existed for it; D27 covers
charts only, and LEAN's dependency budget says a new runtime dependency needs an ADR (`docs/LEAN.md:32`).

The choices were: FullCalendar 7 (current), FullCalendar 6 (published as `legacy`, separate plugin packages), a
second calendar library (Schedule-X is not in SPEC and is a new dependency for one screen), or our own month grid.
The fork was settled by running it, not by asking.

## Prototype result (19 November 2026, `/tmp/fc7-proto`, not committed)

- Installed `@fullcalendar/react@7.1.5`, `temporal-polyfill@1.0.8` (its peer) and React 19.3.1; bundled with the
  repo's esbuild 0.28.2.
- A `dayGridMonth` for November 2026 with 20 PM events, the `daygrid`, `interaction` and classic-theme plugins
  rendered without console or page errors.
- A Playwright mouse drag of the `TC-15` event to the 10 November cell fired `eventDrop` and printed
  `TC-15 -> 2026-11-10`; the event's date changed and the callback saw the new `startStr`.
- Library-only bundle (React external): **256,305 B minified / 73,873 B gzipped**; with React: 479,368 B /
  142,649 B. The theme CSS: 17,103 B / 3,825 B. `npm audit --omit=dev --audit-level=high` reported 0
  high/critical.
- A 35-line hand-rolled month grid (React external) was 1,419 B / 765 B, but it had no month navigation, keyboard
  movement, touch drag, event stacking or "+N more"; a production version would be several hundred lines with
  weaker accessibility.
- v7 consolidates the plugins into `@fullcalendar/react` subpaths (`/daygrid`, `/interaction`, `/themes/classic`);
  the separate `@fullcalendar/daygrid` package at 7.1.5 exists only as a release candidate, and the separate
  packages are the **v6** line. v7 also hashes its CSS class names; the prototype showed that `[data-date]` on a
  day cell, the event text and the theme's CSS variables are the stable hooks (the `.fc-*` names are not).

## Decision

1. **Package:** `@fullcalendar/react` **7.1.5**, pinned exactly, with the `daygrid`, `interaction` and
   `themes/classic` subpath plugins; `temporal-polyfill` **1.0.8** (peer, MIT), pinned exactly. The transitive
   `@fullcalendar/core` 7.1.5 and `@full-ui/headless-calendar` 7.1.5 (both MIT) are recorded in `THIRD_PARTY.md`.
   No premium plugin, no scheduler/resource view, no second calendar library.
2. **One door:** `apps/web/src/screens/analytics/PmCalendar.tsx` is the only file that names `@fullcalendar`. The
   page that imports it is reached by `React.lazy(() => import('./PmCalendarPage.js'))`, so the library is its own
   chunk and never a start-up file. A source guard and a build-chunk guard mirror D27's ECharts guard
   (`apps/web/src/ui/chart/chart-guard.test.ts:48-112`), including a planted violation.
3. **Styling through tokens, not class-name overrides:** the classic theme's CSS variables
   (`--fc-classic-primary`, foreground/background/border/muted/today) are set from `ui/tokens.css` under the app's
   `:root` and `:root[data-theme='dark']`; the event content is our own DOM. No raw colour and no `.fc-*` selector
   in our CSS.
4. **English only for now:** `locale="en"`, `firstDay=1` (Monday), `buttonText.today` from the `pm` catalogue.
   Gujarati is a later locale chunk and translation sweep; the `pm` namespace is already blank in `gu`.
5. **Interaction:** month view, `editable` only for head/admin, `eventDrop` calls the one reschedule endpoint and
   `info.revert()` on refusal; `datesSet` drives the fetched range; `dayMaxEvents` keeps "+N more" accessible.

## Why not the alternatives

- **FullCalendar 6.1.22:** still maintained as the `legacy` line, but it is the previous model, needs the separate
  `@fullcalendar/core|daygrid|interaction` packages, and buys nothing for a new screen in November 2026. Starting on
  a line the vendor calls legacy means a migration later for no present benefit.
- **Schedule-X (or another calendar):** not in SPEC, not in `THIRD_PARTY.md`, a new dependency and licence review
  for one screen; the prototype already proves the named library works.
- **Our own month grid:** the ladder's "already in the codebase / standard library" rung does not reach keyboard
  navigation, touch drag, event stacking, popovers, date ranges and accessible grid semantics. The 765 B toy is
  not the comparison; the production version is several hundred lines of interaction code we would own and test,
  and it would still be less accessible than the library for a 125-machine calendar.
- **FullCalendar premium resource views:** paid; the free month/day/week views cover ticket 50, and a list view is
  another free subpath of the same package. A resource timeline is a new ADR and a licence decision.

## Prototype condition and fallback

The implementation must keep the library out of the start-up files and inside one lazy chunk, and the drag must
work with a mouse and a touch pointer on the real page. If either fails (a start-up import, or a chunk over the
D27-sized budget of roughly 174 KB gzipped, or a drag that cannot be made reliable), the fallback is a hand-rolled
5×7 month grid with HTML5 drag and a keyboard "move" button, in `PmCalendar.tsx`, with the same API and the same
`eventDrop`/reschedule contract. The fallback costs touch drag and the `+N more` popover and must be recorded in
`changes/50-pm-calendar.md`; no other library is authorised.

## Consequences

- One more runtime dependency family, all MIT, with exact pins and a `THIRD_PARTY.md` row; D28's high-advisory gate
  applies to it.
- The PM chunk is about 74 KB gzipped plus 4 KB of CSS that a head/admin downloads only when opening
  `/analytics/pm`; the start-up bundle is unchanged.
- The calendar's DOM class names are hashed and may change between v7 minors. Our CSS targets variables and our own
  event content; the E2E targets `[data-date]`, accessible names and event text, never `.fc-*`.
- Upgrading to v8 is a dependency ticket: re-run the prototype, check the plugin subpaths and the chunk guard. The
  module boundary (one door) keeps that change to one file.
