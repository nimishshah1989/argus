# M1b-import — Bhavin export importer (SPEC 1.10)

## Goal

A `pnpm import:bhavin <file.json>` command that loads Bhavin's ticket export (the format
documented in NEEDS N1) into the pilot tenant — idempotently, with a reconciliation report and an
undo — so the cutover is a data operation, not a rewrite. The real file is still pending (N1);
the importer is built and tested against the documented format with a clearly-labelled synthetic
fixture.

## Input format (from NEEDS N1)

```json
{
  "source": "bhavin-v3",
  "tickets": [
    {
      "legacyId": "string",
      "ref": "BD-123",
      "kind": "stopped | support | general",
      "status": "open | working | waiting | closed | cancelled",
      "machineCode": "M-12 | null",
      "location": "string | null",
      "workType": "string | null",
      "problem": "string",
      "reportedAt": "ISO",
      "reportedByPerson": "Asha",
      "startedAt": "ISO | null",
      "closedAt": "ISO | null",
      "cancelledAt": "ISO | null",
      "closeKind": "report | no_report | done | null",
      "closeNote": "string | null",
      "leadPerson": "Asha | null",
      "parentRef": "BD-120 | null",
      "events": [{ "type": "start", "at": "ISO", "by": "Asha", "text": null, "payload": {} }],
      "crew": [
        {
          "person": "Asha",
          "role": "lead|primary|support",
          "joinedAt": "ISO",
          "leftAt": "ISO|null",
          "leftReason": "string|null"
        }
      ],
      "segments": [
        {
          "person": "Asha",
          "role": "lead",
          "startedAt": "ISO",
          "endedAt": "ISO|null",
          "endReason": "string|null"
        }
      ],
      "reports": [{ "kind": "breakdown", "problem": "…", "…": "…" }]
    }
  ]
}
```

## Process

- `import:bhavin <file> --tenant <slug>` opens an `import_batch` (`source: 'bhavin'`, status
  running→done/failed) and one `import_row` per ticket.
- Per ticket: resolve the **machine** by `code` (with an alias map for N12), resolve/create
  **persons** by name (an existing person, else a `production` person flagged pending — the spec's
  "never stall on a name"), insert the `ticket` (keep the legacy `ref`), its `ticket_event`s
  (seq 1..n), `crew_member`s, `work_segment`s and `breakdown_report`, and link the parent by ref.
- **Idempotent**: a ticket whose `(tenant, ref)` already exists is `skipped` (re-running is safe).
- A bad row becomes `error` with a message (the batch continues; never abort).
- Reconciliation stats in `batch.stats`: tickets/imported/skipped/errored + events/crew/segments
  counts; `import_row.ticket_id` links the created ticket.
- `import:undo <batchId>` deletes the tickets created by that batch (FK cascade) and marks the
  batch `undone`.

## Files and write scope (one worker)

- `apps/server/src/import/bhavin.ts` (parse/validate/map/insert — the core),
  `apps/server/src/import/cli.ts` (arg parsing + pool + report output),
  `tools/import-bhavin.ts` (a thin tsx entry if that's cleaner), `package.json` scripts
  (`import:bhavin`, `import:undo`).
- `apps/server/test/import.test.ts` (new) with a labelled synthetic fixture: two tickets (one full
  with events/crew/segments/report, one duplicate ref → skipped), a re-run skips all, undo removes
  the imported tickets, and a malformed row errors without aborting.
- `docs/plan/NEEDS.md` unchanged (the format is documented there).

## Rules

- The import writes through `withTenant` (RLS) and never touches `command_idempotency`.
- Keep files ≤400/functions ≤60 — split parse/map/insert if needed.
- Synthetic fixtures are allowed and must be labelled as such.
- `pnpm verify` + `pnpm test:e2e` green.

## Out of scope

The real export (N1), analytics/answers import (N2), the Excel/PM import (M4).
