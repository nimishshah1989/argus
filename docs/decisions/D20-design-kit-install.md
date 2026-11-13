# D20 — Design kit install: packages, five components, accent switch, screenshot image

Date: 13 November 2026 · Status: accepted (orchestrator, ticket 10); builds on D04 and D09

## Decision

- **Two runtime packages**, pinned exact in `apps/web/package.json`: `radix-ui` 1.8.1 (MIT, the unified Radix package, so later primitives need no new dependency) and `lucide-react` 1.72.0 (ISC; every D04 icon name exists in it). shadcn/ui is copied by hand: no CLI, no package.
- **Five kit components**, each at most 150 lines: `Button` (primary and secondary only), `Input` with `Label`, `Card`, `Sheet` (Radix Dialog, the one modal) and `StatusPill`. Kit components never accept `className` or `style`.
- **Accent switch**: blue is the default (`#0a66c2`); deep teal is `:root[data-accent='teal']` (`#0d9488`, with `#0f766e` for fills behind white text). Only `/gallery` sets the attribute. Nimish's choice later changes the default in `ui/tokens.css`.
- **Screenshot image**: baselines and CI both run in `mcr.microsoft.com/playwright:v1.65.0-noble` (1.65.0 is the installed `@playwright/test`) plus the OS font package `fonts-noto-core`, so the PNGs are byte-identical everywhere.

## Why

Every future screen is built from one installed kit (D04), and `/gallery` (D09) must be checkable at phone width in both languages. Five components are the minimum tickets 11, 15 and 16 need.

## Rejected

- `clsx`, `tailwind-merge`, `class-variance-authority`: nothing is merged because components take no `className`, and variants are plain objects.
- `@fontsource/noto-sans-gujarati`: phones ship Noto Sans Gujarati, and the image gets the OS font.
- Badge, Dialog, Tabs, Select: StatusPill covers Badge, Sheet is the one modal, the others have no user yet (rule of two).
- Baselines made on a developer machine or the CI runner's own browser: fonts and rendering differ.
