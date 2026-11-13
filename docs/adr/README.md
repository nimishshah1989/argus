# Decisions

One page per irreversible or expensive-to-reverse decision. Each records the context, the decision, what was rejected and why, and the consequences. Start with:

- `0001-stack.md` — own TypeScript stack, not the Atlas fork
- `0002-outside-services.md` — AWS, Meta, Sarvam, push, error tracking, and the data-protection note
- `0003-auth.md` — hand-rolled sessions or better-auth, decided by the M0 spike
- `0004-commercial-layer-deferred.md` — billing, self-serve and plan enforcement come after the product
- `0005-accessibility-test-adapter.md` — dev-only axe Playwright checks for user-facing slices
- `0006-jobs.md` — pg-boss delayed jobs, one shared instance and the migration ledger
- `0007-claude-for-ai-and-onboarding.md` — Claude (option C) for AI features, with the data-protection note; a Claude session only to clean Cosmos's history
