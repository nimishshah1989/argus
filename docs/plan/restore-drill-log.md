# Restore drill log

One row per drill, newest last (runbook: `infra/RESTORE.md`). Paste the two count files under the row. Empty until the
first real run on AWS: the drill needs the account, which no builder session has.

| Date (UTC) | Who | Drill | Restored from | Minutes to available | Counts same? | Result | Notes |
| ---------- | --- | ----- | ------------- | -------------------- | ------------ | ------ | ----- |
| 2026-11-14 06:01-06:30 | Nimish (Mac), orchestrator guiding | A: point-in-time | `uptimo-postgres`, latest restorable time | 11 (06:12:27 to 06:23:34) | yes (`SAME`) | PASS | Copy `uptimo-postgres-restore` deleted after the compare. Runbook fault found: `../../.tools/bin/terraform` does not exist on Nimish's Mac; used the instance id, runbook fixed. Migration 0011 merged during the drill but the restored copy predates its deploy (both show 10). |

Live and restored counts (identical):

```
Success {"migrations":{"applied":10,"last":"0010_retention_support.sql"},"customers":[{"slug":"cosmos","counts":{"tickets":275,"events":889,"workSegments":250,"crew":12,"reports":115,"people":36,"logins":26,"machines":192,"importBatches":2,"importRows":550,"auditRows":0}}]}
```
