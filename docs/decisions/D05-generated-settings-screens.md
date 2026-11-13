# D5 — Settings screens are generated from a `ResourceSpec`

Date: 13 November 2026 · Status: accepted (architect); detail in `docs/ARCHITECTURE.md`

## Decision

A settings screen is one file exporting `{ key, path, schema, columns, fields, permission, titleKey }`, typed against the shared schema and rendered by `CrudPage`. Routes are collected from the folder. A test fails when a schema key is neither a field nor listed as hidden.

## Why

The BRIEF requires that a new screen is mostly configuration. Today four settings files take 959 lines for four small forms, and nine more admin screens are due before cutover.

## Rejected

- AutoForm (named in SPEC §5a): a second form abstraction beside `FormSheet`.
- Hand-written screens.
