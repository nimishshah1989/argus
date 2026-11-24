# ADR 0035: a screen PR may write its own coverage table

Date: 24 Nov 2026 · Decided by: Nimish

quality:pr requires every v2 screen PR to commit `docs/design/v2/scope/<screen>.md`, while loop-guard forbade build branches from touching `docs/design/v2/**`. No screen PR could pass both. loop-guard now lets a build branch change `docs/design/v2/scope/<screen>.md` when the same PR changes `apps/web/src/screens/v2/<screen>/`. Everything else under `docs/design/v2/` stays plan-only.
