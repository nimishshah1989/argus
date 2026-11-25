# HANDOFF

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-25 · **By:** Plan · **Model:** Opus 5.5
**Milestone:** M2b screens lane · **Branch:** plan/kit-css-seeds

## State

- Kit stylesheets seeded by Plan (tokens only, ADR 0036) and pushed; `sheets.ts` auto-loads every `ui/v2/*.css`, so no imports were needed. Typecheck clean on all nine; visible tests red only on `not implemented` / undrawn `data-status`/`data-seg`.
  685 `11530921` kpi-tone.css status edge+badge, unit, basis · 686 `7fb74175` cards.css tile-set, zero-line, show-detail · 691 `66fc63ec` action-strip.css (+ `.v2-strip-link` named in skeleton) · 692 `2cab2f72` severity-row.css · 694 `0362f993` ranked-bars.css (+ row classes, `data-half`/`data-rest` in skeleton) · 697 `1766556d` quadrant.css (+ classes in skeleton) · 699 `2e4159cd` reason-chip.css · 700 `6b2bda83` v2.css `[data-seg]` + entity-chip.css edge · 704 `9b29a06b` status-chip.css (FigureTile edge comes from 685's `.v2-kpi[data-status]`).
- No new tokens: status (`--color-v2-good|watch|bad|neutral-*`) and segment tokens are already on main. #704's body says `--color-v2-status-*`; those do not exist, the CSS uses the real ones.
- Issue bodies of all nine: the CSS line now says "already written in the seed by Plan; do not edit". #692 and #697 were blanked by a failed `gh` read (TLS error) and restored by hand, keeping the coordinator's "Builder shell rules" note. Re-check the nine bodies once; the last full check timed out (GitHub TLS flaky).

## Next step

1. Build branches for 685 and 692 (and 694 if started) must take their seed: merge `plan/t<N>` into the build branch, repoint `Plan-base`, then re-run the builder (tsx only).
2. Start 686 691 697 699 700 704 from the updated seeds.

## Don't repeat

- Never `gh issue edit --body-file` from a read that may have failed: check the file is non-empty first.
- A seed must carry every plan-owned file in its ticket's "Files to change" (LESSONS 25 Nov).
