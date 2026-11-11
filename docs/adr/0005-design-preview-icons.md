# 0005 — Design preview icons

Date: 11 November 2026
Status: accepted

## Context

The D0 design preview needs one precise, accessible icon language for machine conditions, work states and labelled actions. The preview must not introduce hand-authored SVG, emoji, a second icon kit or production screen changes.

## Decision

Use `lucide-react` in `@uptimo/web` for the isolated design preview. Import only the named icons used by the preview, keep Lucide's outline treatment and pair icons with visible text labels. Record the ISC-licensed dependency in `THIRD_PARTY.md`.

## Rejected

- **Hand-authored SVG** — duplicates a maintained icon set and makes stroke and geometry consistency our responsibility.
- **Emoji or font glyphs** — rendering and meaning vary by platform, and they do not provide the requested outline style.
- **A second icon kit** — adds another dependency and a competing visual language without a user benefit.
- **Reusing production components** — would expand this throwaway route into production screens and styles outside the slice.

## Consequences

The preview has one consistent icon source and a small, tree-shaken addition to the web bundle. If the route is deleted rather than absorbed into D0.2, remove `lucide-react` with it unless production work has adopted the same ADR.
