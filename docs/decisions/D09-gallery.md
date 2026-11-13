# D9 — In-app gallery with Playwright screenshot tests

Date: 13 November 2026 · Status: accepted (architect); detail in `docs/ARCHITECTURE.md`

## Decision

A `/gallery` route (local and staging only) renders every token, kit component, status and page pattern with fake data in English and Gujarati. Nimish approves it. Playwright screenshots each section at 360 px in both languages and runs axe; a changed screenshot fails CI until the new image is committed in a design-system PR.

## Why

The BRIEF requires approval on a live gallery before more screens are built, and `FRONTEND-STRATEGY.md` §8 expects visual regression. Playwright and axe are already installed.

## Rejected

- Storybook, Ladle: a new toolchain and a second deploy for one reader.
