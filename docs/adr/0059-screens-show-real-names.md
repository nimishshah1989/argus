# 0059 — Screens show people by name; the engine stays name-free

Date: 26 Nov 2026 · Decided by: Nimish (asked "Analytics shows people as codes (P-3f412b54) on purpose, so no real names appear. Should screens show real names instead?", chose "Show real names")

## Context

The analytics engine reads every person as a pseudonym, `P-` and the first eight characters of the id (`personCode`), and prints that pseudonym wherever a figure names someone: the Breakdown Log's Done by, Manpower, Team Focus, Why-Why, the monthly and annual reports, the workbook. People on the floor do not know who `P-3f412b54` is, and a person chip built from a code opens nothing, because the drawer finds a person by their name.

## Decision

1. Screens, PDFs and the workbook show the person's name wherever the engine prints a person code.
2. The engine stays name-free. `packages/domain` still sees codes only, and what it keeps (`kpi_snapshot`, the served run) still holds codes, never names.
3. The names go in at the server boundary, on the way out: `personNames(tx, tenantId)` reads the plant's people inside the tenant transaction (row-level security applies) and `nameCodes(reply, names)` swaps every `P-xxxxxxxx` in the reply's strings for the name. Both are identity's published interface. They run on `GET /analytics/figures`, `POST /analytics/run`, `/analytics/drill`, `/analytics/compare`, the monthly and annual PDFs, the workbook and the Why-Why PDF.
4. An erased person stays erased: they are left out of the name map, so their code is shown, never their old name and never "Former staff".
5. Reply shapes do not change (a string stays a string), so no reply schema changes. Money and permission rules are untouched. Object keys are not renamed (they are ids, and two people may share a name).

## Consequences

- A person chip now carries the name, so it opens that person's drawer.
- Free text the redactor cleaned before the engine read it (`[P1]` placeholders) is not restored; that is a separate decision.
- `apps/server/test/real-names.test.ts` pins names in replies, codes in `kpi_snapshot` and the erased person's code; `apps/web/src/screens/v2/no-person-codes.test.ts` keeps codes out of every v2 fixture and the gallery's stored replies.
