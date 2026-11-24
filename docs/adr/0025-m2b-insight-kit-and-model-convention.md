# ADR 0025 — M2b: the insight kit and how a model carries its takeaways

Date: 2026-11-24 · Status: accepted (Plan, under ADR 0023)

## Decision

- PROJECT.md gains milestone **M2b — Insight pass** (goals G2b.1–G2b.3) as ADR 0023 asked.
- The kit gains `Takeaway` and `ExpandRow` (`ui/v2/takeaway.tsx`), added by Plan on a `plan/` branch (ADR 0022 precedent); no existing caller changes.
- A screen's model carries `takeaways: Record<sectionId, TakeawayData | null>`, built by its adapter with `outlierTakeaway` (`screens/v2/insight.ts`) or a screen-specific rule, words from the `insight.*` catalogue. This is optional on the type until the screen's ticket makes it required in practice.
- `screens/v2/insight-coverage.test.ts` holds a shrinking `NOT_YET` list and a `SECTIONS` table (screen to section ids). A screen's ticket seed moves it from one to the other; the ticket builds until the test passes.

## Why

A convention checked by a test beats a rule the reviewer must remember. Keying by section id keeps models unchanged in shape: no screen's existing fields move.

## Consequences

Each M2b ticket edits its adapter, model type, View and i18n only. The coverage test and the kit stay Plan-owned.
