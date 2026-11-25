# HANDOFF

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-25 · **By:** Plan · **Model:** Opus 5.5
**Milestone:** M2 (last old-design screens) · **Branch:** plan/s26-a (from origin/main; pushed; no PR)

## State

- Job: issues + seeds for S26-1 (Settings shell + jobs) and S26-2 (machines, groups, shifts) per ADR 0044 decision 4.
- Done: read ADR 0044, wireframe `S26-settings.html`, kit `ui/v2/crud-page.tsx`/`crud-model.ts`, v1 `Plant.tsx`,
  `Jobs.tsx`, `plant-specs.tsx`, `machine-production.tsx`, e2e `settings-plant`/`settings-jobs` selectors.
- Decisions written: `docs/adr/0046-s26-shell-and-plant-pages.md` (folders, shell, registry, jobs list, S26-2 shape).
- NOT done: no issues, no seed branches, no coverage tables yet (context budget hit while designing).

## Next

1. New Plan session: from ADR 0046, create issue S26-1, seed `plan/t<N>`: `screens/v2/settings/{model.ts,registry.ts}`
   skeleton (`mayOpenSettings`, `visiblePages`, `railFor`, `kindWords`, `countLabel`, `jobsWorstFirst`,
   `jobsTakeaway`), new i18n keys in `settings.en.ts`/`.gu.ts`, visible tests + `screens/v2/holdout/settings-*.test.ts`,
   `docs/design/v2/scope/settings.md`. Prove red, lint clean, push.
2. Then S26-2 the same way (`screens/v2/settings-plant/`), depending on S26-1.
3. Open the plan PR for `plan/s26-a` (ADR 0046 + handoff), merge when green.

## Don't repeat

- Don't re-read the v1 files: ADR 0046 + ADR 0044 carry what is needed. Wireframe text dump: grep line 1402 of the html.
