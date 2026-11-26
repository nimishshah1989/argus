# HANDOFF

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-26 ~20:30 IST · **By:** session `c39914a2…` · **Goal (Nimish, ADR 0055):** all screens live on the newest kit, nothing old remains · **Mode (ADR 0057):** organic session, parallel agents · **Branch:** plan/handoff-s30

## State

- **ADR 0055 met by measurement:** `tools/old-ui-left.test.ts` on main f980d307 has `OLD_LEFT = []`. The shipped app renders no old-design component (62 on 26 Nov afternoon → 0).
- Merged this push: #849 guard, #850 S28–S30 approvals, #852 audit fixes (#842), #853 + #856 Board in Shell, #854 Floor on kit, #855 Settings Company/Translations (#794), sign-in, App wiring, lists/profile fix (#846), #857 Desk + Ticket in Shell.
- **plan/remove-old-ui:** every old-design .tsx deleted (shipped or dead), the gallery index is now the v2 kit index, `old-ui-left.test.ts` fails on any old .tsx on disk or any gallery import of one; `docs/design/v2/KIT.md` catalogues the kit; "Open TV view" has its TV icon.
- Nimish approved merging PRs whose only red check is loop-guard "existing test modified on a build branch" (26 Nov). Protected files stay plan-only.

## Not built (server lacks data, or protected file)

- #803 sign-off outcomes list, crew roles and paused jobs under Working, ticket downtime-vs-average line, searchable code lists with last 5 used.
- Board rows open the machine panel, not the ticket. Day-score items out per ADR 0050.

## Next steps

1. Nimish clicks through Desk, Ticket, Board, Floor and Settings on staging. 2. Plan the "not built" items above. 3. Floor segment tiles (ADR 0055 point 1).

## Don't repeat

- Never answer "how much is left" from tickets or memory: run the guard.
- Never tell agents a protected file is editable; CI loop-guard rejects it off plan/ branches.
- Never put the approve command text in a Bash command.
