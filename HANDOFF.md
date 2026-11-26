# HANDOFF

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-26 ~23:00 IST · **By:** session `c39914a2…` · **Goal (Nimish, ADR 0055):** all screens live on the newest kit, nothing old remains · **Mode (ADR 0057):** organic session, parallel agents · **Branch:** plan/handoff-s32 · **Staging:** 78d2eb52 (= main)

## State (all merged and deployed to staging)

- **Nothing old remains (ADR 0055/0057):** `tools/old-ui-left.test.ts` fails on any old-design .tsx on disk or shipped; 0 left. Kit catalogue `docs/design/v2/KIT.md`; `/gallery` is the kit index.
- **Every card goes somewhere (ADR 0060, #866):** `screens/v2/destinations.ts` read by the kit; 171 of 171 cards; guard `destinations.test.ts`. Some cards open their page's rows (the `*` default), not their own.
- **Tables colour themselves, "On this page", bubble labels (ADR 0061, #869):** guard `screens/v2/table-look.test.ts`; 38 of 44 fixture tables colour.
- **Multi-year (ADR 0063, #870):** forecasts, history figures and A1/A3 month trends read 2022–2026; one year picker (`?years=`); year-over-year lines. 2026 answer key unchanged.
- **Data on staging:** 2026 log loaded 26 Nov (#865 job, snapshot `uptimo-pre-history-20261126155839`, batch `9aa60229…`); 2022–2025 was already there (4,220 reports, source of that load untraced). A1 Jan–Sep = answer key; Oct 0.43 vs 0.42 and Nov 0.12 vs 0.22 from earlier live-ticket imports.
- Also merged: Desk/Ticket/Board in Shell, Floor on kit, Settings, real names (ADR 0059, #867), A-codes hidden (ADR 0062, #863), #803 Desk data (#862, #864), TV board fits any screen (#868).
- Nimish approved merging PRs whose only red check is loop-guard "existing test modified on a build branch". Nimish chose "+N more" on the TV over the wireframe's "and N more" (26 Nov).

## Not done

- Nobody has clicked through any of this on staging with real data.
- Breakdown log hours show "0.67", not "40 min". bd-pm month grids uncoloured. 14 screens have no table fixture for the guard.
- Monthly/annual report month charts and Compare's weekly trend still 2026-only. Free text keeps `[P1]` placeholders, not names.
- Do NOT run `history-load.yml -f legacy=true` until the earlier 2022–2025 load's refs are checked (double-count risk).
- `pnpm size` fails on main (floor/View.tsx, live.tsx, ticket/adapter.ts).

## Next steps

1. Nimish clicks through staging. 2. The "Not done" list. 3. Floor segment tiles (ADR 0055 point 1).

## Don't repeat

- Never answer "how much is left" from tickets or memory: run the guards.
- Never tell agents a protected file is editable; loop-guard rejects it off plan/ branches. ADR files are protected too.
- A PR's `Screens:` line must hold approval ids (`S30-board`), and loop-guard reads the body from the push, so re-push after editing it.
- Reserve ADR numbers before parallel agents write them (0058 collided once).
