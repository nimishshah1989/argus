# 41h — the shared seam for ticket 41

**What changed for a user:** nothing visible yet. This is the seam that lets A4 (manpower), A5 (energy), A6 (Why-Why)
and A10 (problem analysis) reproduce their frozen answer keys exactly: the Settings team list reaches the engine
(`teamCodes`), the plant's problem groups and their nine families are typed and overridable (`problemGroups`), the
ticket-36 Why-Why record reaches the engine (`whyWhy`), and the four keys have typed readers. `problemGroupOf` behaves
exactly as before.

**The one assumption worth a reviewer's time (R8).** The answer-key pseudonymiser maps every written form of a name
(short and full) to one `Person NN`, but the platform attributed a breakdown only when the team member's full name
appeared. Nine mentions are therefore over-attributed by an exact code match. The repair is fixture-side:
`fixtures/answer-key/person-mentions.json` gives each mention its own code and keeps its printed name, so no production
rule changes (the live plant has full names) and no key byte changes. Evidence: the staging discovery pack's workbook,
its `Breakdown Log` sheet against its own `Analytics 4 - Manpower` sheet over 1,279 rows. The seam test asserts the map
is **applied**, so shipping the file without applying it is red here rather than late in A4.

**Tests that prove it.** `pnpm exec vitest run packages/domain/test/analytics-workers.test.ts` (12 new tests: 14 team
codes in settings order, 24 groups with their nine families in the platform's order, the four keys' shapes, A5's 20%
factor, the nine mention slots and their printed names, every report name resolving to a person row, an empty Why-Why
seam). Red first: 11 of 12 failed before the source edit (missing fields and readers). Green:
`pnpm exec vitest run packages/domain/test` — 25 files, 364 tests (352 before). `pnpm precheck`: 13 checks pass.

**No parity:** fixture-side R8 repair; no parity row changes (parity reports 119 rows, 0 problems). The parity tool
gains the same data-file exemption `input.json` already had, for `person-mentions.json`.

**Deviations recorded.** (1) `keys.ts` also holds the three key-shape types, because `KeyFigurePage`/`FigureKey` are
typed in terms of them and leaving them behind would make a module cycle; `fixture.ts` re-exports them, so no import
changed. (2) The parity tool's data-file exemption (above). (3) The R8 file and README describe the name forms in
words, not as examples, because the repo forbids real personal data in the repo and `pnpm pii:scan` enforces it; the
nine ids, fields, tokens and codes are exact.
