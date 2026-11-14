# D5 — Settings screens are generated from a `ResourceSpec`

Date: 13 November 2026 · Status: accepted (architect); detail in `docs/ARCHITECTURE.md`

## Decision

A settings screen is one file exporting `{ key, path, schema, columns, fields, permission, titleKey }`, typed against the shared schema and rendered by `CrudPage`. Routes are collected from the folder. A test fails when a schema key is neither a field nor listed as hidden.

## Why

The BRIEF requires that a new screen is mostly configuration. Today four settings files take 959 lines for four small forms, and nine more admin screens are due before cutover.

## Rejected

- AutoForm (named in SPEC §5a): a second form abstraction beside `FormSheet`.
- Hand-written screens.
- A plain `<table>` instead of TanStack Table: sorting, column visibility and virtualised rows (192 machines, 1,354 history rows) would be rewritten in every pattern.
- React state per field instead of react-hook-form: no dirty tracking or schema-driven field errors, and a re-render per keystroke on a low-end phone.

Both libraries are named in SPEC §5a and are verify in current docs.

Amended 13 November 2026 by D27 (ticket 12): until a resource needs sorting, column choice, virtualised rows or schema field errors, `CrudPage` uses a plain `<table>` and `FormSheet`; TanStack Table and react-hook-form are deferred, not rejected.
