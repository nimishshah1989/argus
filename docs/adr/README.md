# Decisions

One page per irreversible or expensive-to-reverse decision. Each records the context, the decision, what was rejected and why, and the consequences. Start with:

- `0001-stack.md` — own TypeScript stack, not the Atlas fork
- `0002-outside-services.md` — AWS, Meta, Sarvam, push, error tracking, and the data-protection note
- `0003-auth.md` — hand-rolled sessions or better-auth, decided by the M0 spike
- `0004-commercial-layer-deferred.md` — billing, self-serve and plan enforcement come after the product
- `0005-accessibility-test-adapter.md` — dev-only axe Playwright checks for user-facing slices
- `0006-jobs.md` — pg-boss delayed jobs, one shared instance and the migration ledger
- `0007-claude-for-ai-and-onboarding.md` — Claude (option C) for AI features, with the data-protection note; a Claude session only to clean Cosmos's history
- `0008-workbook-writer.md` — our own data-only xlsx writer (zipped OOXML), not SheetJS CE or ExcelJS
- `0009-fullcalendar.md` — FullCalendar 7.1.5 (MIT), lazily loaded, for the PM calendar; the prototype and the no-dependency fallback
- `0010-adopt-the-loop.md` — the build process moves from pstack to the loop; the repo's own design system stays
- `0011-adoption-blueprint.md` — PROJECT.md written from the code as built; milestones M1–M5; built screens snapshotted as wireframes
- `0040-kit-only-prs-need-no-screen.md` — `Screens: none (kit only)` passes loop-guard when every changed file is kit, changelog or handoff
- `0041-gujarati-switch-per-phone.md` — Gujarati's `GUJARATI_ON` switch is `localStorage["uptimo.gujarati"] === "on"`, read once at load (e2e option `gujaratiOn`)
