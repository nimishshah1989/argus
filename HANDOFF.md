# HANDOFF

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-26 ~20:30 IST · **By:** session `c39914a2…` · **Goal (Nimish, ADR 0055):** all screens live on the newest kit, nothing old remains · **Mode (ADR 0057):** organic session, parallel agents · **Branch:** v2/board-rows-ticket

## State

- **ADR 0055 met by measurement:** `tools/old-ui-left.test.ts` on main f980d307 has `OLD_LEFT = []`. The shipped app renders no old-design component (62 on 26 Nov afternoon → 0).
- Merged this push: #849 guard, #850 S28–S30 approvals, #852 audit fixes (#842), #853 + #856 Board in Shell, #854 Floor on kit, #855 Settings Company/Translations (#794), sign-in, App wiring, lists/profile fix (#846), #857 Desk + Ticket in Shell.
- **plan/remove-old-ui:** every old-design .tsx deleted (shipped or dead), the gallery index is now the v2 kit index, `old-ui-left.test.ts` fails on any old .tsx on disk or any gallery import of one; `docs/design/v2/KIT.md` catalogues the kit; "Open TV view" has its TV icon.
- **plan/clickable-cards (ADR 0060, Nimish 26 Nov "each and every card will be clickable"):** one destinations map (`screens/v2/destinations.ts`) read by KpiCard, FigureTile and ChartCard; kit DataTable rows open the entity they name; `destinations.test.ts` guard (cards with a destination 24 of 171 → 171 of 171, `NO_DESTINATION` empty); KIT.md also lists `CodePicker`.
- Board rows now open their ticket in the side panel (S30, same `EntityShell` drawer as the Desk); the machine chip still opens the machine; TV unchanged.
- Analytics screens show plain names, no A1–A10 codes (en + gu; Nimish 26 Nov); URL screen ids and engine files keep them. Branch v2/drop-a-codes.
- Nimish approved merging PRs whose only red check is loop-guard "existing test modified on a build branch" (26 Nov). Protected files stay plan-only.
- Branch v2/desk-data (Refs #803): the four S28/S29 items the server lacked are built server + UI: sign-off outcomes of the last 24 h on `/board/signoff`, `GET /state/crew` (crew roles, paused jobs under Working now), `machineAverage` on the ticket detail (engine MTTR in minutes, "no earlier breakdown" when none), `GET /tickets/recent-codes` + searchable code pickers (`CodePicker` in ui/v2/close-kit.tsx). No migration.
- Branch v2/real-names (ADR 0059, Nimish 26 Nov "Show real names"): analytics/drill/compare replies, monthly/annual PDFs, workbook and Why-Why PDF print people's names instead of `P-xxxxxxxx` codes (identity `personNames` + `nameCodes` at the server boundary); the engine and `kpi_snapshot` stay name-free; erased people keep their code.
- Branch v2/desk-data-2 (follow-up to #862): Team takeaway counts paused jobs by reason; paused jobs read "Paused · reason" (en + gu); e2e `desk-data.spec.ts` clicks a sign-off outcome row and the close-form code picker (machines SO-D, SO-E).
- Branch v2/tv-board-fit (Nimish's staging screenshot, 26 Nov): the wall TV (`?kiosk=1`) no longer clips below 1920 by 1080. Cause: its type and spacing were fixed 1920 by 1080 pixels since #808 (not #853, #856, #860 or #861), so a smaller window squeezed the columns to nothing; `.board-tv` now rebinds the TV tokens to one unit of `min(100vw/1920, 100dvh/1080)`, the overflow line reads "+N more" (en + gu), e2e `board-tv-fit.spec.ts` checks five sizes by 0, 4 and 25 stops.

- **plan/multi-year-analytics (ADR 0063, Nimish 26 Nov "use all of that data to create trend lines"):** forecasts, history figures and the A1/A3 month trends read every year by default (2026 headlines and answer key unchanged); `GET /analytics/figures?years=` (year, range or `all`, kept per span); one `YearPicker` in the `LiveFrame` header (`?years=` in the URL); kit lines draw year over year.
- Branch plan/table-colour-page-nav (ADR 0061, Nimish 26 Nov on Problem Analysis): tables colour themselves from each column's `look` (bars, top-three marks in loss red / gain green, category pills, no raw floats; guard `screens/v2/table-look.test.ts`), every page gets "On this page" (right rail ≥1280 px, jump menu on phones, sections in ⌘ K), quadrant labels placed without overlap. ADR 0062: A-codes are internal ids; ADR 0059 (real names) carried from v2/real-names.

## Not built (server lacks data, or protected file)

- Day-score items out per ADR 0050.

## In flight (26 Nov ~21:00, Nimish: "build the not-built items… all old stuff removed… a proper design language with components and kit")

- Agent E `v2/desk-data-2`: #862 follow-up (paused wording, Team paused takeaway, e2e for outcomes and code picker).
- Agent F `v2/board-rows-ticket`: Board rows open the ticket side panel.
- Agent G `plan/remove-old-ui`: delete ~125 old .tsx + old gallery pages, guard forbids any old .tsx, TV icon, docs/design/v2/KIT.md catalogue + DESIGN.md Components (protected files; Nimish's instruction is the authority).
- Merge each when everything except loop-guard's test-edit rule is green (/private/tmp gate script logic: no other red, loop-guard reasons only 'existing test modified'). G is plan/ so loop-guard should pass.

## Next steps

1. Nimish clicks through Desk, Ticket, Board, Floor and Settings on staging. 2. Plan the "not built" items above. 3. Floor segment tiles (ADR 0055 point 1).

## Don't repeat

- Never answer "how much is left" from tickets or memory: run the guard.
- Never tell agents a protected file is editable; CI loop-guard rejects it off plan/ branches.
- Never put the approve command text in a Bash command.
