# 0062 — A1…A10 are internal ids, never shown

Date: 26 Nov 2026 · Decided by: Nimish ("can we remove this A3, A4 and all everywhere")

## Decision

The spec codes A1 to A10 name the analytics screens inside the project only: engine figure keys and file names
(`a5-energy`, `a9-bottleneck.ts`), URL screen ids (`?screen=a4-manpower`, so saved links keep working), test names and
the spec (`PARITY.md`). A reader never sees one: screen titles, tabs, the rail, search, drill labels ("Show the rows
behind Energy heatmap"), the Guide and reports use the plain name ("MTTR and MTBF", "Breakdowns vs PM"). #863 removed
them from the English and Gujarati catalogues and the registry; `packages/shared/test/no-spec-codes.test.ts` fails a
catalogue value that starts with one. The v2 scope pages (`docs/design/v2/scope/`) quote user-facing words without
them too.
