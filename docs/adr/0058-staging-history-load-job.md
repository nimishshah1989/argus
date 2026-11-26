# 0058 — The staging history load job (69d): snapshot first, files bucket for the workbooks

Date: 26 Nov 2026 · Decided by: the coordinator, on Nimish's "Yes, load it" (26 Nov) to loading the 2026 history and, once uploaded, the 2022–2025 workbooks into staging

## Context

Staging held only the 275 live tickets, and the analytics engine counts history-sourced tickets, so A1 and the other history tables read 0.00%. ADR 0027 item 4 planned the job (69d) and the `analytics.data-from` setting; neither was built. Slice 69 named the backup bucket's `legacy/<year>/` folder for the workbooks and a fresh dump before the load.

## Decision

1. `.github/workflows/history-load.yml` (manual only) runs `infra/instance/history-load.sh` on the instance over SSM, like `backup.yml`. The script stops on anything that is not staging, takes an RDS snapshot `uptimo-pre-history-<UTC time>`, and loads nothing if the snapshot fails. **A snapshot, not a dump:** the weekly dump fails on RDS (the master login is subject to row security), and the snapshot is the same backup `deploy.sh` takes before a migration.
2. In the running release's image, `apps/server/src/seed/history-load.ts` writes `analytics.data-from` = `2026-01-01`, adds the log's people the plant lacks as pending placeholders (slice 69 R8), and loads the 1,283 non-live rows of the 2026 log (slice 37c) through the importer. A re-run imports 0.
3. The server now reads `analytics.data-from` into the engine's `settings.dataFrom` (ADR 0027 decision 2). With only 2026 data loaded this changes no figure.
4. **The workbooks go to the files bucket, `legacy/`, not the backup bucket.** The instance role may read only `dumps/` in the backup bucket; it already reads the files bucket. This needs no Terraform change. With `legacy: true` the job copies `legacy/` to a temp folder (always removed) and runs `tools/load-legacy.ts --allow-remote`.
5. No `staging` environment with a required reviewer (slice 69 asked for one): it is a repository setting outside the code. The job runs only from `main` and only by hand.

## Cost if wrong

The 2026 load is one import batch: `import:undo <batchId>` removes it, or the snapshot is restored (infra/RESTORE.md). The setting is one row. Moving the workbooks' folder to the backup bucket means one IAM statement and a `terraform apply`.
