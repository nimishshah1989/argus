# ADR 0037: PR paperwork warns, never blocks

Date: 24 Nov 2026 · Decided by: Nimish ("yes 0037")

A screen took 10-20 minutes to build and hours to merge, almost all of it CI rounds on PR-body paperwork. These checks now report but never block: `parity:update`, `pr:size`, `quality:pr`, `changelog:check`. Still blocking: typecheck, lint, tests, browser and gallery, `pii:scan`, gitleaks, licences, migrations, `ui:check`, audits and `loop-guard` (protected files, tests, approvals).
