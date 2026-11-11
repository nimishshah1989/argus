# `argus.synthetic-bhavin/v1` — synthetic-only import contract

**This is an invented test contract, not the N1 export schema and not a compatibility claim.**
It exists to exercise the importer without a real export, real personal data, or production access.
Only top-level `source: "argus.synthetic-bhavin/v1"` is accepted. Every other source—including
`bhavin-v3`, a purported N1 export, a crawl, CSV, Excel, or PDF—is rejected before a batch is
created. Real N1 acquisition, schema confirmation, compatibility, and cutover remain separate work.

## 1. JSON and source envelope

Every named object is strict: unknown keys and missing required keys are errors. No collection,
`null`, zero, date, shift, actor, or report value is defaulted. All arrays and nullable fields must
be present explicitly.

| Field     | Type      | Rules                                                                 |
| --------- | --------- | --------------------------------------------------------------------- |
| `source`  | string    | Exactly `argus.synthetic-bhavin/v1`; checked before the other fields. |
| `aliases` | object    | Exactly `machines`, `people`, and `maintenanceCodes`.                 |
| `tickets` | unknown[] | Required, at most 2,000 raw rows; each row is parsed independently.   |

Each alias map is a plain string-to-string record with at most 512 entries. Keys and targets are
nonempty and at most 256 UTF-16 code units. Machine and maintenance-code keys are compared after
`normalizeCode`; people keys after `normalizeKey`. Empty or duplicate normalized keys and empty
normalized targets are errors. Aliases are applied at most once by reference resolution. The example
mappings below are invented and no machine/person/maintenance mapping is built into the importer.

`normalizeKey` applies NFC, trims, collapses Unicode whitespace, and lower-cases. `normalizeCode`
then upper-cases. Strings and object keys may not contain U+0000 at any depth. Only plain JSON values
are accepted: no `Date`, `undefined`, bigint, non-finite number, class instance, or cycle.

## 2. Ticket fields

| Field              | Type           | Required/nullable and validation                             |
| ------------------ | -------------- | ------------------------------------------------------------ |
| `legacyId`         | string         | Trimmed, nonempty, 1–128 UTF-16 units.                       |
| `ref`              | string         | `^(BD                                                        | WR)-([0-9]+)$`; suffix 1–2,147,483,646. |
| `entryType`        | enum           | `ordinary` or `pastBreakdown`.                               |
| `kind`             | enum           | `stopped`, `support`, or `general`.                          |
| `status`           | enum           | `open`, `working`, `waiting`, `closed`, or `cancelled`.      |
| `machineCode`      | string \| null | Required for stopped/support; null for general.              |
| `location`         | string \| null | Nonnull for general.                                         |
| `workType`         | string \| null | Nonnull for general.                                         |
| `problem`          | string         | Nonempty, at most 4,096 UTF-16 units.                        |
| `reportedAt`       | timestamp      | Required.                                                    |
| `reportedByPerson` | string \| null | Explicitly nullable.                                         |
| `parentRef`        | ref \| null    | Nonnull only for a general WR child; must differ from `ref`. |
| `state`            | object         | All fields in §4, including every null cache.                |
| `events`           | event[]        | Required, at most 2,000.                                     |
| `crew`             | crew[]         | Required, at most 128.                                       |
| `segments`         | segment[]      | Required, at most 2,000.                                     |
| `reports`          | report[]       | Required, at most one; a ticket machine is required.         |
| `storedFigures`    | object         | Exactly the nine fields in §7.                               |

Stopped/support require `BD`; general requires `WR`. `pastBreakdown` requires stopped/BD and nonnull
report response and repair values. Ordinary rows may use every kind. IDs, codes, and names are at
most 256 UTF-16 units; notes, reasons, corrective action, root cause, spares, and handover text are
at most 4,096. Per-person figures are derived and are never imported.

## 3. Time, number, byte, and depth rules

A timestamp is exactly `YYYY-MM-DDTHH:mm:ss[.sss](Z|±HH:mm)`, with one to three fractional digits.
Month/day and leap years are real, hour is 00–23, minute/second are 00–59, offset hour is 00–14,
offset minute is 00–59, and hour 14 permits only minute 00. Timezone-less values, `UTC`, impossible
dates, 24:00, and leap seconds are rejected. Parsing returns the represented `Date` instant; it does
not coerce a local time.

Report `date` is independently validated as `YYYY-MM-DD`; it is not derived from a timestamp.
Minute values and `transfers` are safe integers from 0 through 1,000,000. Nullable minute fields
must be present as `null` when absent.

| Limit                         |     Value | Measurement                                                     |
| ----------------------------- | --------: | --------------------------------------------------------------- |
| CLI file bytes                | 5,242,880 | File `stat`, checked before JSON parsing or DB work by the CLI. |
| Canonical raw ticket bytes    |   262,144 | UTF-8 bytes of canonical raw JSON.                              |
| Canonical event payload bytes |     8,192 | UTF-8 bytes of the individual raw payload.                      |
| Whole JSON depth              |        16 | Root is 1; each property/array-element level adds 1.            |
| Event payload depth           |         8 | Same root/level rule.                                           |
| Edit changes                  |        10 | Per edit event, plus unique-field validation.                   |
| Reports                       |         1 | Per ticket.                                                     |
| Report people                 |       128 | Separately for `doneBy` and `supportedBy`.                      |

Canonical JSON sorts object keys recursively by UTF-16 code unit and retains array order. Byte caps
are evaluated on that canonical representation. String caps use JavaScript `.length`.

## 4. Required state cache

`state` is strict and contains every field below. Timestamps are strict timestamps or null.

| Field              | Type                                      | Field              | Type              |
| ------------------ | ----------------------------------------- | ------------------ | ----------------- |
| `selfStarted`      | boolean                                   | `startedAt`        | timestamp \| null |
| `segmentStartedAt` | timestamp \| null                         | `leadPerson`       | string \| null    |
| `handedOver`       | boolean                                   | `handoverSince`    | timestamp \| null |
| `transferToPerson` | string \| null                            | `transferToShift`  | string \| null    |
| `transfers`        | nonnegative integer                       | `waitReason`       | string \| null    |
| `waitSince`        | timestamp \| null                         | `pausedByPerson`   | string \| null    |
| `assignedToPerson` | string \| null                            | `expectedBackAt`   | timestamp \| null |
| `waitingSpare`     | string \| null                            | `machineRunningAt` | timestamp \| null |
| `machineStoppedAt` | timestamp \| null                         | `kindUpgradedAt`   | timestamp \| null |
| `closedAt`         | timestamp \| null                         | `closedByPerson`   | string \| null    |
| `closeKind`        | `report` \| `no_report` \| `done` \| null | `closeNote`        | string \| null    |
| `cancelledAt`      | timestamp \| null                         |                    |                   |

These are supplied cache values to cross-check, not instructions to invent state. In particular, a
`down` timestamp is not a `machineStoppedAt` value. State/event/interval reconciliation is performed
by the pure domain mapping after this strict structural parse.

## 5. Events and edits

Every event requires `{type, at, by, text, payload}`. `by` and `text` are nullable strings unless a
rule below requires otherwise. `at` is a strict timestamp. Payloads are strict typed objects—not
arbitrary records—and are checked recursively for byte size, depth, NUL, and finite numbers.

| `type`                                                          | Exact payload                                                                                      | Additional actor/text rule                                        |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `down`, `start`, `pickup`, `running`, `stopped`, `upgrade_kind` | `{}`                                                                                               | `down` is seq 0; start/pickup actors are nonnull.                 |
| `join`                                                          | `{role: "primary" \| "support"}`                                                                   | Actor nonnull.                                                    |
| `leave`, `restore`                                              | `{}`                                                                                               | Actor and nonnull reason in `text` required.                      |
| `pause`                                                         | `{reason: string, assignTo: string \| null, expectedBackAt: timestamp \| null, isVendor: boolean}` | Actor nonnull; `text` is an optional note.                        |
| `resume`                                                        | `{}`                                                                                               | Actor nonnull; `text` is an optional note.                        |
| `transfer`                                                      | `{to: string \| null, toShift: string \| null}`                                                    | Actor and nonnull handover `text`; exactly one target is nonnull. |
| `update`                                                        | `{spare: string \| null, expectedBackAt: timestamp \| null}`                                       | Actor and nonnull update `text`.                                  |
| `close`                                                         | `{kind: "report" \| "no_report" \| "done"}`                                                        | Actor nonnull; `text` is the close note.                          |
| `cancel`                                                        | `{previousStatus: "open" \| "working" \| "waiting"}`                                               | Actor and nonnull reason in `text`.                               |
| `report`                                                        | `{}`                                                                                               | Actor nonnull; `text` must be null.                               |
| `edit`                                                          | `{changes: change[]}`                                                                              | Actor and nonnull reason in `text`; at most 10 changes.           |

An edit change is exactly `{field, from, to}`, and a field occurs at most once in one edit.

| `field`                                       | `from`                              | `to`                |
| --------------------------------------------- | ----------------------------------- | ------------------- |
| `reportedAt`                                  | timestamp                           | timestamp           |
| `startedAt`, `closedAt`                       | timestamp \| null                   | timestamp           |
| `problem`                                     | string                              | string              |
| `machineCode`, `leadPerson`, `closedByPerson` | string \| null                      | string \| null      |
| `kind`                                        | `stopped` \| `support` \| `general` | same                |
| `handsOnOverrideMin`, `waitingOverrideMin`    | nonnegative integer \| null         | nonnegative integer |

Lookalike fields such as `activeMin`, `waitMin`, `responseMin`, `repairMin`, `downtimeMin`, and
`overrides` are rejected. Override clearing is not part of this synthetic contract.

## 6. Crew, segments, and reports

Crew is exactly `{person, role, joinedAt, leftAt, leftReason}` with role `lead`, `primary`, or
`support`. `leftReason` is nonnull exactly when `leftAt` is nonnull.

A segment is exactly `{person, role, startedAt, endedAt, endReason}` with the same roles. `endReason`
is `pause`, `transfer`, `leave`, `close`, `cancel`, or null, and is nonnull exactly when `endedAt` is
nonnull. Different-person overlapping segments are legal; state/interval reconciliation handles the
remaining chronology rules.

A report has exactly these fields:

| Field         | Type                        | Field               | Type                        |
| ------------- | --------------------------- | ------------------- | --------------------------- |
| `kind`        | literal `breakdown`         | `problem`           | nonempty string             |
| `date`        | calendar date               | `shiftCode`         | string                      |
| `observedBy`  | string \| null              | `correctiveAction`  | string \| null              |
| `downtimeMin` | nonnegative integer         | `responseMin`       | nonnegative integer \| null |
| `repairMin`   | nonnegative integer \| null | `breakdownCategory` | string \| null              |
| `maintCode`   | string \| null              | `spareUsed`         | string \| null              |
| `rootCause`   | string \| null              | `handoverName`      | string \| null              |
| `doneBy`      | string[]                    | `supportedBy`       | string[]                    |
| `submittedAt` | timestamp                   | `submittedBy`       | string                      |

`doneBy` and `supportedBy` are independently capped at 128 entries each, have unique normalized
names within each array, and are disjoint. One report can therefore insert at most 256 report-person
rows. Ordinary reports may explicitly use null response/repair; past breakdowns may not. No report
field is inferred from the current clock, close time, a shift named `A`, `observedBy`, or zero.

## 7. Stored figures and raw identity

`storedFigures` has exactly:

| Field             | Type                        | Field        | Type                        |
| ----------------- | --------------------------- | ------------ | --------------------------- |
| `responseMin`     | nonnegative integer \| null | `activeMin`  | nonnegative integer         |
| `waitMin`         | nonnegative integer         | `vendorMin`  | nonnegative integer         |
| `handoverWaitMin` | nonnegative integer         | `downAccMin` | nonnegative integer         |
| `downtimeMin`     | nonnegative integer \| null | `followMin`  | nonnegative integer \| null |
| `repairMin`       | nonnegative integer         |              |                             |

The stored raw envelope is:

```text
{
  format: "argus.import-raw/v1",
  raw: <original raw ticket>,
  canonicalJson: <canonical raw ticket>,
  rawSha256: SHA-256(canonical raw ticket),
  identitySha256: SHA-256(canonical {ticket: raw, aliases})
}
```

Hashes are lowercase hexadecimal. Key-order-only changes preserve both hashes. Ticket changes alter
both; alias-only changes alter only identity; array-order changes alter both. Parsed `Date` objects
are never canonicalized.

## 8. Complete invented example (not N1)

Every name, code, alias, identifier, timestamp, and value in this example is synthetic. This complete
example is not a sample of, or a migration path for, a real export.

```json
{
  "aliases": {
    "machines": { "SYNTH-MACHINE": "M-1" },
    "maintenanceCodes": { "SYNTH-MAINT": "M" },
    "people": { "SYNTH-LEAD": "Asha" }
  },
  "source": "argus.synthetic-bhavin/v1",
  "tickets": [
    {
      "crew": [
        {
          "joinedAt": "2026-11-01T10:05:00Z",
          "leftAt": null,
          "leftReason": null,
          "person": "SYNTH-LEAD",
          "role": "lead"
        },
        {
          "joinedAt": "2026-11-01T10:30:00Z",
          "leftAt": null,
          "leftReason": null,
          "person": "Bina",
          "role": "support"
        }
      ],
      "entryType": "ordinary",
      "events": [
        {
          "at": "2026-11-01T10:00:00Z",
          "by": "SYNTH-LEAD",
          "payload": {},
          "text": null,
          "type": "down"
        },
        {
          "at": "2026-11-01T10:05:00Z",
          "by": "SYNTH-LEAD",
          "payload": {},
          "text": null,
          "type": "start"
        },
        {
          "at": "2026-11-01T10:30:00Z",
          "by": "Bina",
          "payload": { "role": "support" },
          "text": null,
          "type": "join"
        },
        {
          "at": "2026-11-01T11:00:00Z",
          "by": "SYNTH-LEAD",
          "payload": { "kind": "report" },
          "text": "Synthetic repair complete",
          "type": "close"
        }
      ],
      "kind": "stopped",
      "legacyId": "synthetic-legacy-0100",
      "location": "Cell-1",
      "machineCode": "SYNTH-MACHINE",
      "parentRef": null,
      "problem": "Synthetic spindle alarm",
      "ref": "BD-0100",
      "reportedAt": "2026-11-01T10:00:00Z",
      "reportedByPerson": "SYNTH-LEAD",
      "reports": [
        {
          "breakdownCategory": "E",
          "correctiveAction": "Synthetic spindle reset",
          "date": "2026-11-01",
          "doneBy": ["SYNTH-LEAD"],
          "downtimeMin": 60,
          "handoverName": null,
          "kind": "breakdown",
          "maintCode": "SYNTH-MAINT",
          "observedBy": "Engineer",
          "problem": "Synthetic spindle alarm",
          "repairMin": 55,
          "responseMin": 5,
          "rootCause": "Synthetic cause",
          "shiftCode": "1",
          "spareUsed": null,
          "submittedAt": "2026-11-01T11:00:00Z",
          "submittedBy": "SYNTH-LEAD",
          "supportedBy": ["Bina"]
        }
      ],
      "segments": [
        {
          "endReason": "close",
          "endedAt": "2026-11-01T11:00:00Z",
          "person": "SYNTH-LEAD",
          "role": "lead",
          "startedAt": "2026-11-01T10:05:00Z"
        },
        {
          "endReason": "close",
          "endedAt": "2026-11-01T11:00:00Z",
          "person": "Bina",
          "role": "support",
          "startedAt": "2026-11-01T10:30:00Z"
        }
      ],
      "state": {
        "assignedToPerson": null,
        "cancelledAt": null,
        "closeKind": "report",
        "closeNote": "Synthetic repair complete",
        "closedAt": "2026-11-01T11:00:00Z",
        "closedByPerson": "SYNTH-LEAD",
        "expectedBackAt": null,
        "handedOver": false,
        "handoverSince": null,
        "kindUpgradedAt": null,
        "leadPerson": "SYNTH-LEAD",
        "machineRunningAt": null,
        "machineStoppedAt": null,
        "pausedByPerson": null,
        "segmentStartedAt": "2026-11-01T10:05:00Z",
        "selfStarted": false,
        "startedAt": "2026-11-01T10:05:00Z",
        "transferToPerson": null,
        "transferToShift": null,
        "transfers": 0,
        "waitReason": null,
        "waitSince": null,
        "waitingSpare": null
      },
      "status": "closed",
      "storedFigures": {
        "activeMin": 55,
        "downAccMin": 60,
        "downtimeMin": 60,
        "followMin": null,
        "handoverWaitMin": 0,
        "repairMin": 55,
        "responseMin": 5,
        "vendorMin": 0,
        "waitMin": 0
      },
      "workType": "breakdown"
    }
  ]
}
```

This document defines only the synthetic correction contract. It does not define a real adapter,
N12 alias decisions, a migration, a compatibility matrix, a production procedure, or a cutover.
