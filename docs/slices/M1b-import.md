# M1b-import — synthetic Bhavin importer correction (SPEC 1.10/12)

## 1. Goal, release shape, and hard boundary

Deliver one coherent **R3 synthetic-importer correction PR** for:

```sh
pnpm import:bhavin <file.json> --tenant <slug> [--production-confirm]
pnpm import:undo <batchUuid> --tenant <slug> [--production-confirm]
```

The PR imports only the explicitly synthetic contract below, reconciles domain state and figures,
advances references safely, and provides a guarded, auditable, later-work-refusing undo. It corrects
the reviewed implementation at `ae17369`; it is not a real Bhavin adapter and not a cutover.

- Accept only top-level `source: "argus.synthetic-bhavin/v1"`. Reject `bhavin-v3`, every real or
  purported N1 export, crawls, CSV, Excel, PDF, and every other source **before creating a batch**.
- Publish only `docs/spec/import/argus-synthetic-bhavin-v1.md`. **Do not create**
  `docs/spec/import/bhavin-export.schema.json`: the real schema, N12 decisions, N1 adapter,
  compatibility claim, zero-unexplained-mismatch run, and cutover remain external N1 work.
- `import_batch.source='bhavin'` is only the existing internal provenance category needed for undo;
  it is not evidence that a real Bhavin file was accepted. The synthetic contract id and hash are in
  `stats`.
- No migration, new table/column/index, new dependency, lockfile change, new WR raise flow, real
  personal data, real export fixture, production execution, or unrelated isolation-list refactor.
- Existing `tools/import-bhavin.ts`, both package scripts, `docs/plan/NEEDS.md`, all migrations, and
  all domain source files remain unchanged. The importer calls the existing domain `figures()`; it
  does not fork figure rules or write `command_idempotency`.
- Every source file is at most 400 lines and every function at most 60 lines (also complexity 12,
  depth 4, at most 4 parameters). The named splits below are part of the plan, not coder discretion.

### `size:large` rationale (required verbatim in the PR)

> `size:large`: this is one atomic R3 correction of an unsafe importer. The strict contract, raw-row
> savepoints and fatal batch lifecycle, zero-based event persistence, identity/counter locking,
> domain state/figure reconciliation, and fingerprinted app_api-only undo must be reviewed and land
> together; landing any subset leaves a runnable importer with a known cross-tenant, data-loss,
> duplicate-ref, or unreconciled-figure hazard. The diff adds validation and regression tests rather
> than cutting them, has no migration or dependency, uses disjoint task scopes, and contains no
> unrelated refactor. The exception is for R3 atomicity, not because the branch has no PR.

Do not split off `ticket-sql.ts` in this implementation: the sequence and locking corrections are
part of the same safety invariant. Use the label above; `LEAN_ALLOW_LARGE=1` is only a local runner
equivalent, never a substitute for the written reason.

## 2. Review amendments and minimal rulings

| Review amendment  | Binding plan response                                                                                                                                                                                                                                                                                                                        |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 CLI role        | `security.ts` validates args/mode/UUID first, then requires exactly `app_api` with `rolsuper=false` and `rolbypassrls=false` on a CLI connection before tenant resolution or import/undo. Every error fails closed; tenant predicates remain.                                                                                                |
| 2 Undo            | `undo.ts` locks a tenant-visible Bhavin `done`/`failed` batch and its imported tickets, verifies provenance/channel and completion fingerprints, refuses later work and outside references, deletes reports before tickets, preserves raw rows/people/counters/`finished_at`, and writes one before/after audit row in the same transaction. |
| 3 Rows/fatal      | `json.ts` rejects NUL recursively. `batch.ts`/`bhavin.ts` use a raw-insert savepoint and a nested ticket savepoint, minimal safe error raw rows, success-only progress, separately committed batch creation, and a fresh fatal-failure transaction followed by a nonzero error.                                                              |
| 4 Input           | `schema.ts` is strict at every object, has explicit required/nullable fields and collections, typed event payloads and DB enums, strict calendar/offset timestamps, concrete bounds, code-reference checks, and chronological/interval validation. Different-person overlaps are valid.                                                      |
| 5 State/sequences | `state.ts`/`state-events.ts` reduce every event and cross-check every supplied cache scalar. Imported events are `0..n-1`, `last_event_seq=n-1`; runtime append is `last+1`, while raise remains `0`.                                                                                                                                        |
| 6 Figures         | `figures.ts` distinguishes ordinary/backfill, derives only evidenced overrides, calls domain `figures()`, persists all nine caches and overrides, reconciles cache and report values, and emits structured issues with CLI failure semantics.                                                                                                |
| 7 Identity        | `identity.ts` uses canonical JSON + SHA-256, stable `legacyId`, ref, and alias interpretation; deterministic in-file rules, non-undone provenance, tenant advisory locks, savepoint recovery, and stale-skip handling cover concurrency and undo/reimport.                                                                                   |
| 8 Aliases         | Explicit separate machine/person/maintenance-code maps replace all N12 constants. Normalized aliases require unique active targets. Unknown people become pending production; ambiguous people and unresolved/inactive machines/codes are errors.                                                                                            |
| 9 Parents         | `parents.ts` pre-plans imported and skipped declarations before ticket insertion, resolves forward/backward refs, repairs only prior synthetic imports, rejects conflicts/missing/self/cycles/cross-tenant paths, and never deletes a skipped pre-existing ticket.                                                                           |
| 10 Counters       | Shared advisory locks cover import and `allocateRef`. `counters.ts` considers current counter, every tenant ticket, and successful imported/skipped refs for BD then WR; errors cannot advance, `GREATEST` cannot decrease, undo never decreases, and exhaustion fails.                                                                      |
| 11 CLI tests      | `import-cli.test.ts` spawns the real pnpm commands against disposable Postgres with both app_api and owner URLs. Pure guards are supplemental; integration tests assert exact fields, links, cascades, and subsequent real HTTP commands.                                                                                                    |
| 12 N1/parity      | `PARITY.md` gains the source import row; `parity.yaml` is regenerated from it with `in-progress`, synthetic-only evidence, and no fake PR. Source validation is tested. Real N1/schema/cutover stays external.                                                                                                                               |
| 13 Lean/artifacts | Named security/undo/reconciliation/state/fingerprint modules meet budgets; `HANDOFF.md` is rewritten below 50 lines and `STATUS.md` corrected to actual facts. No test is deleted, skipped, renamed to hide coverage, or weakened.                                                                                                           |

### Minimal technical rulings (not open coder choices)

1. **Backfill undo:** a synthetic `entryType:'pastBreakdown'` persists `raised_channel='backfill'`.
   Undo accepts both `import` and `backfill`, but only when the matching imported-row provenance,
   entry type in the fingerprint, and batch all agree. Ordinary entries always use `import`.
2. **Cross-person overlap:** overlapping segments for different resolved people are legal and the
   domain union counts them once. Inverted, same-person overlapping, and state-contradictory
   intervals are row errors. Adjacent intervals (`endedAt === next.startedAt`) are legal.
3. **Failed and empty undo:** `done` and `failed` are terminal and undoable. A failed batch with zero
   imported tickets may complete its **first** undo with `{deleted:0}`, audit, and become `undone`;
   every repeat of any undone batch is an error, not fresh success.
4. **Unmatched people:** an unmatched normalized name creates an active pending production person
   and is listed in reconciliation. An ambiguous active name, ambiguous/inactive alias target, or
   inactive known target is an error. A configured alias to a vendor resolves that vendor person.
5. **Explained versus unexplained figures:** compare stored values with the final, legitimately
   overridden domain result. An evidenced override is reported as `info` even when it changes the
   baseline by more than one; a final unexplained null/type difference or absolute difference >1 is
   `error`. A nonexact absolute difference <=1 is a listed `warning`, not silently hidden.
6. **Fatal persistence:** batch creation commits separately so the main transaction can roll back
   all partial work. A fresh transaction then records `failed`, `finished_at`, and fatal stats. If
   the database is itself unavailable and that transaction also fails, persistence is impossible:
   throw an `AggregateError`, exit nonzero, and never claim a report was saved.
7. **Raw-insert failure:** if Postgres cannot store the raw envelope, retain only a minimal error
   envelope containing the already-computed SHA-256, never retry the unsafe raw value. This is the
   explicit exception to raw-value preservation and is reported as `raw_insert_failed`.
8. **Rerun parent repair:** a cleared parent may be repaired only on a ticket previously imported by
   a non-undone synthetic Bhavin batch whose canonical identity still matches. The repair is listed
   in `parentRepairs` and is not reverted by the rerun batch. Undo of the old batch still compares
   its original fingerprint with current state and refuses if they differ (a repair that restores
   the original parent also restores that digest). A pre-existing non-import duplicate is never
   mutated: its declared parent must already match or the row errors.
9. **Alias interpretation is identity:** ticket identity covers the raw ticket plus the complete
   alias configuration. Changing either is a payload conflict, preventing an alias-only rerun from
   silently reinterpreting an already skipped row.
10. **No WR redesign:** the counter module handles both imported prefixes. The existing HTTP raise
    path remains BD-only; this slice adds no WR endpoint or UI.

## 3. Parallel implementation DAG and exclusive write scopes

Tasks 10, 11, and 12 may implement in parallel against the frozen interfaces in §4–§9. Test fixtures
are owned by task 10 precisely so another task never edits them. Integration starts after task 10/12
focused tests are green and task 11 has completed its security/undo/fingerprint modules and direct
undo tests; the real CLI subprocess tests stay red until integration supplies `importBhavin`. Final
artifact work and a rerun of every focused suite are part of integration. No two writers share a
file.

| Owner                                                    | Exclusive files                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Dependency / exit                                                                                                                                                                                          |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **task-10: contract**                                    | `apps/server/src/import/schema.ts`; new `apps/server/src/import/json.ts`, `event-schema.ts`; new `apps/server/test/import-schema.test.ts`; new shared synthetic-only `apps/server/test/import-fixture.ts`; new `docs/spec/import/argus-synthetic-bhavin-v1.md`                                                                                                                                                                                                                                                            | No dependency. T01–T12 red first, then green; publishes parsed types, limits, canonical identity helpers, and fixture builders.                                                                            |
| **task-11: CLI/security/undo**                           | `apps/server/src/import/cli.ts`; new `security.ts`, `undo.ts`, `fingerprint.ts`, `fingerprint-sql.ts` under `apps/server/src/import/`; new `apps/server/test/import-cli.test.ts`; new `apps/server/test/import-undo.test.ts`                                                                                                                                                                                                                                                                                              | Parallel with 10/12. T13–T20 subprocess tests are authored red and run by integration; T21–T25 direct undo tests go green in this scope. Integration wires the `bhavin.ts` re-export.                      |
| **task-12: pure domain mapping**                         | new `apps/server/src/import/state.ts`, `state-events.ts`, `state-edit.ts`, `intervals.ts`, `reconcile.ts`, `figures.ts`; new `apps/server/test/import-state.test.ts`, `import-reconcile.test.ts`, `import-figures.test.ts`                                                                                                                                                                                                                                                                                                | Parallel with 10/11 using the written contracts. T26–T35 red first. Pure except for importing domain functions/types; no pg, fs, CLI, or clock reads.                                                      |
| **integration: DB orchestration + commands + artifacts** | `apps/server/src/import/bhavin.ts`, `insert.ts`; new `batch.ts`, `identity.ts`, `references.ts`, `parents.ts`, `counters.ts`, `insert-reports.ts`; `apps/server/src/ticket-sql.ts`; existing `apps/server/test/import.test.ts`, `tickets-commands.test.ts`; new `apps/server/test/import-integration.test.ts`, `import-commands.test.ts`; `docs/spec/PARITY.md`, `docs/spec/parity.yaml`; `tools/parity.ts`, `tools/parity.test.ts`; new `tools/sync-parity.ts`; `docs/HANDOFF.md`, `docs/plan/STATUS.md`, `CHANGELOG.md` | After the contract/pure/undo checkpoint. T36–T50 red first, integrate without interface changes, make T13–T20 green, rerun all focused suites, then run the entire suite and final source/artifact review. |

No other file may change. In particular, task owners must not “helpfully” edit `package.json`,
`tools/import-bhavin.ts`, the DB harness, migrations, domain files, or another scope's tests. If a
new file or interface is discovered as necessary, stop and return to the planner.

## 4. Published TypeScript contracts

These are the complete cross-module interfaces. Internal helpers remain private; no additional
exported convenience API is allowed without a plan amendment.

### 4.1 `json.ts` and `schema.ts` (task-10)

```ts
export const SYNTHETIC_SOURCE = 'argus.synthetic-bhavin/v1' as const;
export const IMPORT_LIMITS = {
  fileBytes: 5_242_880,
  rawTicketBytes: 262_144,
  eventPayloadBytes: 65_536,
  tickets: 2_000,
  events: 2_000,
  crew: 128,
  segments: 2_000,
  reports: 1,
  reportPeople: 128,
  editChanges: 32,
  aliasesPerKind: 512,
  jsonDepth: 16,
  payloadDepth: 8,
  shortString: 256,
  freeText: 4_096,
} as const;

export function assertSafeJson(value: unknown): void; // plain JSON only, depth/NUL/finite numbers
export function canonicalJson(value: unknown): string; // sorted object keys, array order retained
export function canonicalSha256(value: unknown): string; // lowercase hex SHA-256 of canonicalJson
export function normalizeKey(value: string): string; // NFC, trim, collapse Unicode whitespace, lower-case
export function normalizeCode(value: string): string; // normalizeKey then upper-case
export function strictIsoTimestamp(value: string): Date; // no coercion; validation rules in §5
export function strictCalendarDate(value: string): string; // YYYY-MM-DD including leap years

// event-schema.ts
export const bhavinEventSchema: ZodType<BhavinEvent>;
export type BhavinEditChange = {
  field:
    | 'reportedAt'
    | 'startedAt'
    | 'closedAt'
    | 'problem'
    | 'machineCode'
    | 'kind'
    | 'leadPerson'
    | 'closedByPerson'
    | 'handsOnOverrideMin'
    | 'waitingOverrideMin';
  from: unknown;
  to: unknown;
};

export interface AliasConfig {
  machines: Record<string, string>;
  people: Record<string, string>;
  maintenanceCodes: Record<string, string>;
}
export type EntryType = 'ordinary' | 'pastBreakdown';
export interface BhavinState {
  selfStarted: boolean;
  startedAt: Date | null;
  segmentStartedAt: Date | null;
  leadPerson: string | null;
  handedOver: boolean;
  handoverSince: Date | null;
  transferToPerson: string | null;
  transferToShift: string | null;
  transfers: number;
  waitReason: string | null;
  waitSince: Date | null;
  pausedByPerson: string | null;
  assignedToPerson: string | null;
  expectedBackAt: Date | null;
  waitingSpare: string | null;
  machineRunningAt: Date | null;
  machineStoppedAt: Date | null;
  kindUpgradedAt: Date | null;
  closedAt: Date | null;
  closedByPerson: string | null;
  closeKind: 'report' | 'no_report' | 'done' | null;
  closeNote: string | null;
  cancelledAt: Date | null;
}
export interface StoredFigures {
  responseMin: number | null;
  activeMin: number;
  waitMin: number;
  vendorMin: number;
  handoverWaitMin: number;
  downAccMin: number;
  downtimeMin: number | null;
  followMin: number | null;
  repairMin: number;
}
export interface BhavinTicket {
  legacyId: string;
  ref: string;
  entryType: EntryType;
  kind: 'stopped' | 'support' | 'general';
  status: 'open' | 'working' | 'waiting' | 'closed' | 'cancelled';
  machineCode: string | null;
  location: string | null;
  workType: string | null;
  problem: string;
  reportedAt: Date;
  reportedByPerson: string | null;
  parentRef: string | null;
  state: BhavinState;
  events: BhavinEvent[];
  crew: BhavinCrew[];
  segments: BhavinSegment[];
  reports: BhavinReport[];
  storedFigures: StoredFigures;
}
export interface SyntheticExport {
  source: typeof SYNTHETIC_SOURCE;
  aliases: AliasConfig;
  tickets: unknown[];
}
export interface StoredRawPayload {
  format: 'argus.import-raw/v1';
  raw: unknown;
  canonicalJson: string;
  rawSha256: string;
  identitySha256: string;
}
export function parseSyntheticExport(input: unknown): SyntheticExport; // source checked first
export function parseTicket(raw: unknown): BhavinTicket;
export function makeRawEnvelope(raw: unknown, aliases: AliasConfig): StoredRawPayload;
export function messageOf(error: unknown): string;

export type IssueSeverity = 'info' | 'warning' | 'error';
export interface ImportIssue {
  rowNumber: number;
  legacyId: string | null;
  ref: string | null;
  code: string;
  field: string | null;
  stored: number | null;
  computed: number | null;
  delta: number | null;
  severity: IssueSeverity;
  message: string;
}
export interface CompletionFingerprint {
  version: 1;
  algorithm: 'sha256';
  digest: string;
  tickets: Array<{ ticketId: string; legacyId: string; entryType: EntryType; digest: string }>;
}
export interface ImportStats {
  contract: typeof SYNTHETIC_SOURCE;
  status: 'done' | 'failed';
  tickets: number;
  imported: number;
  skipped: number;
  errored: number;
  events: number;
  crew: number;
  segments: number;
  reports: number;
  reportPeople: number;
  pendingPeople: number;
  pendingPersons: string[];
  exactMatches: number;
  toleratedMismatches: number;
  hardMismatches: number;
  overridesApplied: number;
  parentRepairs: Array<{ rowNumber: number; ref: string; parentRef: string }>;
  issues: ImportIssue[];
  aliasSha256: string;
  refCounters: { BD: number | null; WR: number | null };
  fatal: { message: string } | null;
  completion: CompletionFingerprint | null;
}
```

`BhavinEvent` is the exported discriminated union whose members correspond exactly to §5.3;
`BhavinCrew`, `BhavinSegment`, and `BhavinReport` are inferred from their strict Zod schemas and
exported as types. `makeRawEnvelope` hashes `raw` for `rawSha256` and hashes
`{ticket: raw, aliases}` for `identitySha256`. `canonicalJson` recursively sorts object keys by UTF-16
code unit, retains array order, rejects non-plain objects, undefined, bigint, non-finite numbers,
NUL in keys/strings, and depth >16. Dates exist only after parsing and are never canonicalized.

`ImportStats` counters are exact committed outcomes. For nonfatal batches,
`imported + skipped + errored === tickets`; `events`, `crew`, `segments`, `reports`, and
`reportPeople` count imported rows only. Warnings do not make a batch failed; any row error or hard
mismatch does. Fatal stats use `imported=skipped=0`, `errored=tickets`, all child counts zero,
`fatal={message}`, `completion` equal to the empty-batch fingerprint, and null counter values.

### 4.2 Security, fingerprint, and undo (task-11)

```ts
// security.ts
export type CliCommand =
  | { mode: 'import'; file: string; tenantSlug: string; productionConfirm: boolean }
  | { mode: 'undo'; batchId: string; tenantSlug: string; productionConfirm: boolean };
export class CliUsageError extends Error {
  readonly exitCode = 2;
}
export function parseCliArgs(argv: string[]): CliCommand;
export function assertProductionAccess(command: CliCommand, appEnv: string | undefined): void;
export function assertAppApiRole(pool: Pool): Promise<void>;

// cli.ts
export function main(argv?: string[]): Promise<void>;

// fingerprint.ts
export const TICKET_FINGERPRINT_COLUMNS = [
  'id',
  'ref',
  'kind',
  'status',
  'machine_id',
  'machine_snapshot',
  'location',
  'work_type',
  'urgent',
  'problem',
  'problem_lang',
  'reported_at',
  'reported_by_person_id',
  'reported_by_role',
  'raised_login_id',
  'raised_channel',
  'self_started',
  'started_at',
  'lead_person_id',
  'segment_started_at',
  'handed_over',
  'handover_since',
  'transfer_to_person_id',
  'transfer_to_shift',
  'transfers',
  'wait_reason',
  'wait_since',
  'paused_by_person_id',
  'assigned_to_person_id',
  'expected_back_at',
  'waiting_spare',
  'machine_running_at',
  'machine_stopped_at',
  'closed_at',
  'closed_by_person_id',
  'close_kind',
  'close_note',
  'cancelled_at',
  'parent_id',
  'task_reason',
  'task_expected_on',
  'task_down_min',
  'kind_upgraded_at',
  'last_event_seq',
  'response_min',
  'active_min',
  'wait_min',
  'vendor_min',
  'handover_wait_min',
  'down_acc_min',
  'downtime_min',
  'follow_min',
  'repair_min',
  'overrides',
  'edited_at',
] as const;
export type TicketFingerprintColumn = (typeof TICKET_FINGERPRINT_COLUMNS)[number];
export interface BatchTicketSnapshot {
  rowNumber: number;
  legacyId: string;
  entryType: EntryType;
  ticketId: string;
  ticket: Record<TicketFingerprintColumn, unknown>; // SQL column names; timestamps canonical ISO
  events: Array<{
    seq: number;
    type: string;
    idempotencyKey: string | null;
    at: string;
    loginId: string | null;
    actingPersonId: string | null;
    text: string | null;
    payload: Record<string, unknown>;
  }>;
  crew: Array<{
    id: string;
    personId: string;
    role: 'primary' | 'support';
    joinedAt: string;
    leftAt: string | null;
    leftReason: string | null;
  }>;
  segments: Array<{
    id: string;
    personId: string;
    role: 'lead' | 'primary' | 'support';
    startedAt: string;
    endedAt: string | null;
    endReason: 'pause' | 'transfer' | 'leave' | 'close' | 'cancel' | null;
  }>;
  reports: Array<{
    id: string;
    machineId: string;
    date: string;
    shiftCode: string;
    problem: string;
    observedBy: string | null;
    correctiveAction: string | null;
    downtimeMin: number;
    responseMin: number | null;
    repairMin: number | null;
    breakdownCategory: string | null;
    maintCode: string | null;
    spareUsed: string | null;
    rootCause: string | null;
    handoverName: string | null;
    signatureFileId: string | null;
    pdfFileId: string | null;
    qrPayload: Record<string, unknown>;
    submittedByPersonId: string | null;
    submittedAt: string;
    approvedAt: string | null;
    people: Array<{ personId: string; role: 'done' | 'supported' }>;
  }>;
}
export interface BatchSnapshot {
  tickets: BatchTicketSnapshot[];
}
export function makeCompletionFingerprint(snapshot: BatchSnapshot): CompletionFingerprint;
export function emptyCompletionFingerprint(): CompletionFingerprint;
export function fingerprintMismatches(
  expected: CompletionFingerprint,
  actual: CompletionFingerprint,
): string[];

// fingerprint-sql.ts
export function loadBatchSnapshot(
  client: PoolClient,
  tenantId: string,
  batchId: string,
  lockTickets: boolean,
): Promise<BatchSnapshot>;

// undo.ts
export function undoImport(
  pool: Pool,
  tenantId: string,
  batchId: string,
): Promise<{ deleted: number }>;
```

`parseCliArgs` accepts exactly one target and one `--tenant <slug>`, plus at most one
`--production-confirm`; unknown/duplicate flags, extra positionals, a missing value, an invalid
UUID, or an invalid slug throws `CliUsageError`; `main` prints usage and sets exit code 2 for that
class only. UUID uses canonical 8-4-4-4-12 hex; slug uses
`^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$`. `assertProductionAccess` requires `APP_ENV === 'staging'`
or the explicit flag for both write commands, before reading `DATABASE_URL`. `assertAppApiRole`
runs `SELECT current_user AS name, rolsuper, rolbypassrls FROM pg_roles WHERE rolname=current_user`
on a dedicated pool client and requires one row exactly equal to `app_api,false,false`; missing rows,
query/connect errors, and every other role throw before `resolveTenant`.

`main` checks file size before reading/parsing JSON, creates the pool only after guards, calls the
role guard before tenant resolution, always ends the pool, prints one JSON result, and sets
`process.exitCode=1` for a completed `failed` import. Unexpected errors reach the existing entry
point's catch and exit 1. Import success prints `{batchId,stats}`; undo prints
`{batchId,deleted}`. No secret, connection URL, raw payload, or stack is printed.

### 4.3 Pure state/reconcile/figures (task-12)

```ts
// state-events.ts
export interface MutableImportedState extends BhavinState {
  status: BhavinTicket['status'];
  kind: BhavinTicket['kind'];
  machineCode: string | null;
  problem: string;
  reportedAt: Date;
  overrides: FigureOverrides;
  editedAt: Date | null;
}
export function applyImportedEvent(
  state: MutableImportedState,
  event: BhavinEvent,
  seq: number,
): TicketEvent;

// state-edit.ts
export function applyImportedEdit(
  state: MutableImportedState,
  event: Extract<BhavinEvent, { type: 'edit' }>,
  seq: number,
): TicketEvent;

// intervals.ts
export interface ReconciledCrewMember {
  personId: string;
  role: 'primary' | 'support';
  joinedAt: Date;
  leftAt: Date | null;
  leftReason: string | null;
}
export function validateIntervals(
  ticket: BhavinTicket,
  reduced: ReducedTicket,
  people: ReadonlyMap<string, string>,
): { crew: ReconciledCrewMember[]; segments: WorkSegment[] };

// state.ts
export interface ReducedTicket {
  ticket: BhavinTicket;
  state: BhavinState;
  kind: 'stopped' | 'support' | 'general';
  machineCode: string | null;
  problem: string;
  reportedAt: Date;
  overrides: FigureOverrides;
  domainEvents: TicketEvent[];
  editedAt: Date | null;
  lastEventSeq: number;
}
export function reduceTicketState(ticket: BhavinTicket): ReducedTicket;

// figures.ts
export interface FigureComputation {
  asOf: Date;
  figures: Figures;
  overrides: FigureOverrides;
  issues: ImportIssue[];
}
export function computeTicketFigures(input: {
  ticket: BhavinTicket;
  reduced: ReducedTicket;
  segments: WorkSegment[];
  reports: ReconciledReport[];
  now: Date;
}): FigureComputation;

// reconcile.ts
export interface ReconcileReferences {
  timeZone: string;
  machine: { id: string; code: string; category: string | null; cell: string | null } | null;
  people: ReadonlyMap<string, string>; // normalizeKey(name) -> resolved UUID; includes every name used
  shifts: ReadonlyMap<string, { startsAt: string; endsAt: string; crossesMidnight: boolean }>;
}
export interface ReconciledReport {
  machineId: string;
  date: string;
  shiftCode: string;
  problem: string;
  observedBy: string | null;
  correctiveAction: string | null;
  downtimeMin: number;
  responseMin: number | null;
  repairMin: number | null;
  breakdownCategory: string | null;
  maintCode: string | null;
  spareUsed: string | null;
  rootCause: string | null;
  handoverName: string | null;
  submittedByPersonId: string;
  submittedAt: Date;
  doneByPersonIds: string[];
  supportedByPersonIds: string[];
}
export interface ReconciledTicket {
  reduced: ReducedTicket;
  figureResult: FigureComputation;
  crew: ReconciledCrewMember[];
  segments: WorkSegment[];
  reports: ReconciledReport[];
  pendingPersons: string[];
}
export class ReconcileError extends Error {
  readonly issues: ImportIssue[];
}
export function reconcileTicket(
  ticket: BhavinTicket,
  refs: ReconcileReferences,
  now: Date,
): ReconciledTicket;
```

`now` is passed in, never read from the clock. Pure functions create issues with `rowNumber=0`;
integration replaces that with the one-based input row when adding issues to batch stats.
`ReconcileError` is used for state/figure/report errors so the raw row can be
marked without losing structured issues. No function infers a person, shift, report date, close
actor, override, or machine not present in the parsed contract/reference map.

### 4.4 Integration modules

```ts
// references.ts
export function loadTicketReferences(
  ctx: ImportCtx,
  ticket: BhavinTicket,
  aliases: AliasConfig,
): Promise<{ refs: ReconcileReferences; pendingPersons: string[] }>;

// insert.ts
export function importTicket(
  client: PoolClient,
  tenantId: string,
  ticket: BhavinTicket,
  context: { aliases: AliasConfig; now: Date },
): Promise<{
  ticketId: string;
  events: number;
  crew: number;
  segments: number;
  reports: number;
  reportPeople: number;
  pendingPersons: string[];
}>;

// insert-reports.ts
export function insertReports(
  ctx: ImportCtx,
  ticketId: string,
  reports: ReconciledReport[],
): Promise<{ reports: number; reportPeople: number }>;

// identity.ts
export interface PlannedRow {
  rowNumber: number;
  raw: unknown;
  envelope: StoredRawPayload;
  ticket: BhavinTicket | null;
  outcome: 'import' | 'skip' | 'error';
  existingTicketId: string | null; // existing skip initially; set to the new id after import
  parentId: string | null; // existing DB parent only
  parentRowNumber: number | null; // symbolic in-file parent until that row has imported
  issues: ImportIssue[];
}
export function planRows(
  ctx: ImportCtx,
  rows: unknown[],
  aliases: AliasConfig,
): Promise<PlannedRow[]>;

// parents.ts
export function planParentGraph(ctx: ImportCtx, plans: PlannedRow[]): Promise<PlannedRow[]>;
export function applyParentLinks(
  ctx: ImportCtx,
  plans: PlannedRow[],
): Promise<Array<{ rowNumber: number; ref: string; parentRef: string }>>;

// counters.ts
export function advanceRefCounters(
  ctx: ImportCtx,
  plans: PlannedRow[],
): Promise<{ BD: number; WR: number }>;

// batch.ts
export interface ImportCtx {
  client: PoolClient;
  tenantId: string;
}
export function openBatch(
  pool: Pool,
  tenantId: string,
  input: { ticketCount: number; aliasSha256: string; now: Date },
): Promise<string>;
export function markBatchFatal(
  pool: Pool,
  tenantId: string,
  batchId: string,
  input: { ticketCount: number; aliasSha256: string; error: unknown; now: Date },
): Promise<ImportStats>;
export class ImportFatalError extends Error {
  constructor(batchId: string, cause: unknown);
  readonly batchId: string;
}

// bhavin.ts
export function importBhavin(
  pool: Pool,
  tenantId: string,
  input: unknown,
): Promise<{ batchId: string; stats: ImportStats }>;
export { undoImport } from './undo.js';
```

`importBhavin` captures `const now = new Date()` once per call and passes it everywhere. The existing
three-argument public signature and undo result remain. Existing import paths continue to work.

`ticket-sql.ts` adds only:

```ts
export function lockRefCounter(
  client: PoolClient,
  tenantId: string,
  prefix: 'BD' | 'WR',
): Promise<void>;
```

`allocateRef` takes that lock before its `FOR UPDATE` read, refuses `next_value > 2147483646`, and
keeps its BD-only public signature. `persistResult` uses `loaded.ticket.lastEventSeq + 1` for
`startSeq`; raise continues to pass `startSeq:0`.

## 5. Strict synthetic JSON contract (task-10)

Every object below is Zod `.strict()`; unknown keys are errors. Every named key is required, with
`null` allowed only where shown. Arrays have no defaults. Optional/deprecated legacy keys are not
accepted. The synthetic documentation contains the same field tables and a complete invented
example, and repeatedly labels it non-N1.

### 5.1 Top level, aliases, identity, and refs

- Top level: `{source, aliases, tickets}`. `source` is the literal above; `tickets` is an array of
  unknown raw rows capped at 2,000 so bad rows can become `import_row.error` rather than failing the
  whole file. Alias records are plain objects with at most 512 entries each.
- Alias keys and values are nonempty strings <=256. After `normalizeCode` for machine/maintenance
  aliases or `normalizeKey` for people, duplicate normalized keys are an error. Empty targets are an
  error. These maps contain invented synthetic mappings only; no MEC/NI/INT/FS/PP/UTI/ELE/HYD/ROT
  value is built in.
- `legacyId`: trimmed nonempty string, 1–128 chars. `ref`: `^(BD|WR)-([0-9]+)$`, numeric suffix
  1–2,147,483,646. `BD` is required for stopped/support and `WR` for general.
- `entryType`: `ordinary` or `pastBreakdown`. Past breakdown must be stopped/BD; ordinary may use
  every kind. `kind`, `status`, and `parentRef` are explicit. A nonnull parent requires
  `kind='general'`, hence WR; parent and child refs cannot be equal.
- `machineCode`, `location`, `workType`, `reportedByPerson`, `parentRef`, and all nullable state
  fields must be present even when null. Stopped/support require a machine; general requires null
  machine and nonnull location/workType. Any report requires a ticket machine.
- `problem` is 1–4,096 chars. IDs/codes/names are <=256 except `legacyId` <=128. All other free text
  (notes, reasons, corrective action, root cause, spares, handover) is <=4,096. No string or key may
  contain U+0000 at any depth.

### 5.2 Timestamp, number, payload, and size rules

- Timestamp syntax is exactly `YYYY-MM-DDTHH:mm:ss[.sss](Z|±HH:mm)`; fractional seconds may have
  1–3 digits. Validate actual month/day/leap year, hour 00–23, minute/second 00–59, offset hour
  00–14 and minute 00–59 (14:00 only when hour 14), then construct `Date`. Reject impossible dates
  such as 2026-02-30, timezone-less values, the word UTC, and offset-less dates. No `z.coerce.date`.
- Report `date` is independently validated `YYYY-MM-DD`; it is never derived from a timestamp.
- All minute values and `transfers` are safe integers >=0 and <=1,000,000. `responseMin`,
  `downtimeMin`, `followMin`, and report response/repair are nullable where stated; all other stored
  figures are required numbers. No default zero is supplied for a missing report downtime.
- CLI file bytes >5,242,880 fail before JSON parse or DB work. Canonical raw ticket bytes >262,144
  and canonical individual event payload bytes >65,536 are row errors. Byte counts are UTF-8
  `Buffer.byteLength`, file bytes come from `stat`, and string caps use JavaScript UTF-16 `.length`.
  Root JSON depth is 1 and each object-property/array-element level adds 1. Whole JSON depth >16 or
  event payload depth >8 is an error. Arrays cap at the constants in §4.1, including one
  report/ticket and 32 edit changes/event. Tests use each exact cap and cap+1.
- Event payloads are strict discriminated objects, not arbitrary `z.record`. Their canonical bytes,
  depth, strings, numbers, and NUL are checked recursively. Unknown lookalike override fields fail.

### 5.3 Event, crew, segment, report, and stored-figure fields

All event objects require `{type,at,by,text,payload}`. `by` and `text` are nullable strings; actor
requirements are enforced by the reducer. Payloads are:

| Event `type`                                                    | Exact payload shape and additional actor/text rule                                                                                     |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `down`, `start`, `pickup`, `running`, `stopped`, `upgrade_kind` | `{}`; `down` must be seq 0; start/pickup actors nonnull                                                                                |
| `join`                                                          | `{role:'primary' or 'support'}`; actor nonnull                                                                                         |
| `leave`, `restore`                                              | `{}`; actor and nonnull reason in `text` required                                                                                      |
| `pause`                                                         | `{reason:string, assignTo:string or null, expectedBackAt:timestamp or null, isVendor:boolean}`; actor nonnull; optional note is `text` |
| `resume`                                                        | `{}`; actor nonnull; optional note is `text`                                                                                           |
| `transfer`                                                      | `{to:string or null,toShift:string or null}`; actor and nonnull handover note in `text`; exactly one of `to`/`toShift` may be nonnull  |
| `update`                                                        | `{spare:string or null,expectedBackAt:timestamp or null}`; actor and nonnull update `text`                                             |
| `close`                                                         | `{kind:'report' or 'no_report' or 'done'}`; actor nonnull; `text` is close note                                                        |
| `cancel`                                                        | `{previousStatus:'open' or 'working' or 'waiting'}`; actor and nonnull reason in `text`                                                |
| `report`                                                        | `{}`; actor nonnull; `text=null`                                                                                                       |
| `edit`                                                          | `{changes:Array<{field,from,to}>}`; actor and nonnull reason in `text`; fields below                                                   |

Edit `field` is one of `reportedAt`, `startedAt`, `closedAt`, `problem`, `machineCode`, `kind`,
`leadPerson`, `closedByPerson`, `handsOnOverrideMin`, `waitingOverrideMin`. Types are exact:
reportedAt from/to are nonnull timestamps; startedAt/closedAt from is timestamp-or-null and to is a
nonnull timestamp; problem from/to are nonnull strings; machineCode/leadPerson/closedByPerson from/
to are string-or-null; kind from/to are stopped/support/general; handsOn/waiting from is a
nonnegative integer or null and to is a nonnull nonnegative integer (there is no override-clearing
in this contract). A field occurs at most once in one edit. `activeMin`, `waitMin`, `responseMin`,
`repairMin`, `downtimeMin`, `overrides`, and every other lookalike are rejected.

Crew requires `{person,role:'lead'|'primary'|'support',joinedAt,leftAt,leftReason}`; `leftReason`
is nonnull iff `leftAt` is nonnull. Segment requires
`{person,role:'lead'|'primary'|'support',startedAt,endedAt,endReason}`; `endReason` is one of
`pause|transfer|leave|close|cancel` and is nonnull iff `endedAt` is nonnull.

A report requires all of:

```text
kind:'breakdown', problem, date, shiftCode,
observedBy:string|null, correctiveAction:string|null,
downtimeMin:nonnegative integer,
responseMin:nonnegative integer|null, repairMin:nonnegative integer|null,
breakdownCategory:string|null, maintCode:string|null,
spareUsed:string|null, rootCause:string|null, handoverName:string|null,
doneBy:string[], supportedBy:string[],
submittedAt:timestamp, submittedBy:string
```

No report field is invented from `now`, close time, shift `A`, observedBy, or zero. Past breakdown
requires nonnull response and repair because all three report values become explicit overrides.
`doneBy` and `supportedBy` each have unique normalized names and are disjoint.

`storedFigures` is strict and required with exactly the nine fields in §4.1; per-person values are
derived, never imported. `events`, `crew`, `segments`, and `reports` are all required collections.
`state` contains exactly every `BhavinState` field and is required, including `selfStarted` and
`kindUpgradedAt`; no current-state cache is optional or silently defaulted.

## 6. Row planning, raw persistence, fatal lifecycle, and identity

### 6.1 Batch and per-row algorithm

1. Validate source/top-level aliases/file caps before opening any batch. Capture one batch `now`.
2. `openBatch` uses its own `withTenant` transaction to insert
   `(tenant_id,source='bhavin',status='running',started_at=now,stats={contract,status:'running',tickets,aliasSha256})`
   and commits.
3. In a second `withTenant` transaction, acquire
   `pg_advisory_xact_lock(hashtext('bhavin-import:' || tenantId))`, then shared BD and WR ref locks
   in that order. The tenant import lock serializes same-tenant batches; ref locks serialize raises.
4. `planRows` parses/canonicalizes all rows and applies deterministic in-file and DB identity rules.
   `planParentGraph` validates all parent declarations before any ticket/person insert and returns a
   dependency-ready array: parents before children, otherwise one-based input row order. Planning
   performs reads only; new parents are represented by `parentRowNumber`, not a guessed UUID. A
   planned error is still persisted as a raw error in step 5.
5. For each raw row in that dependency-ready order (its persisted `row_number` remains input order):
   - `SAVEPOINT import_raw`; insert pending `import_row` with tenant, batch, one-based row number,
     safe `source_ref` (valid legacyId else null), and the raw envelope. Then
     `SAVEPOINT import_ticket`.
   - If raw insert throws, `ROLLBACK TO import_raw`, insert a minimal row with
     `payload={format:'argus.import-error/v1',rawSha256}`, status `error`, and safe source_ref. A
     failure of that minimal insert is fatal. Release the savepoint and continue.
   - For a planned error, roll back to `import_ticket` and mark the raw row `error`. For a skip,
     update it to `skipped` and its existing `ticket_id`. For an import, call `importTicket`, write
     the returned id into `existingTicketId`, then update `imported` and the new `ticket_id`. All
     updates include tenant, batch, and row id.
   - Any parse/reference/state/figure/SQL error rolls back to `import_ticket`, leaving the raw row
     but removing every ticket/child/new-person write, then marks `error` with a bounded safe
     message. Known validation errors retain their field path; database errors retain only SQLSTATE
     and constraint name (never SQL text, connection URL, raw value, or stack). SQLSTATE 23505
     triggers one identity re-read after rollback. Only an exact same synthetic imported identity
     may become a skip; a newly visible non-import ticket or any ref/payload/provenance conflict is
     an error, so parent rules never need to be guessed again mid-flight. Release both savepoints.
   - If a new parent row fails, immediately change every not-yet-processed descendant to a planned
     `parent_unavailable` error, depth-first by row number. Topological ordering proves no descendant
     was already inserted. Thus reference/figure failure of a parent cannot strand a valid-looking
     child or turn an expected row error into a fatal parent-link update.
   - Mutate imported/skipped counts, child counts, pending lists, parent progress, and ref maxima
     only after the corresponding successful commit-to-savepoint outcome. Increment `errored` only
     after an error row is safely marked. Failed rows contribute no ref/parent progress.
6. Resolve each successful row's parent from `parentId` or the now-populated `existingTicketId` of
   `parentRowNumber`, then apply the already validated parent updates in row-number order. Unexpected
   SQL failure or a missing resolved id here is fatal, not a later-row error. Set counters from
   successful outcomes, load the actual completion snapshot, store its fingerprint and final stats,
   and set batch `done` iff `errored=0` and `hardMismatches=0`, otherwise `failed`, with
   `finished_at=now`. Commit.
7. Any unexpected error in the main transaction rolls it back. `markBatchFatal` then uses a fresh
   `withTenant` transaction to mark the separately created batch failed/finished with fatal stats
   and an empty fingerprint. Throw `ImportFatalError(batchId,cause)` (or `AggregateError` if fatal
   marking also fails); CLI exits nonzero. No partial main-transaction ticket/raw/person/counter
   survives.

### 6.2 Canonical identity and concurrency rules

Canonical raw JSON retains array order and recursively sorts keys. The identity digest covers the
raw ticket and full aliases. Existing identity reads join tenant-scoped `import_row` to a
tenant-scoped non-undone `source='bhavin'` batch with `status IN ('done','failed')`,
`import_row.status IN ('imported','skipped')`, and `stats->>'contract'='argus.synthetic-bhavin/v1'`.
Error rows never block a corrected retry. A matching legacy row without a valid versioned
raw envelope/digest is a hard legacy-identity error, never a guessed skip.

- Same tenant + legacyId + ref + identity digest: skip and link the existing ticket. A skipped
  provenance row with null `ticket_id` is stale (its ticket was undone elsewhere) and is ignored;
  a non-undone imported provenance row with no ticket is a hard dangling-identity error.
- Same legacyId but changed ref, raw payload, or aliases: error. Same imported ref associated with a
  different legacyId: error. Multiple existing identities for one legacyId that disagree: error.
- A same-ref pre-existing ticket with no imported provenance is skipped for compatibility with the
  original behavior; it is never an undo candidate. Undone batches are ignored for identity.
- In-file identical legacyId/ref/digest duplicates: earliest is eligible; later rows skip only if
  the earliest imports/skips successfully, otherwise they error as duplicates of the failed row.
  Earliest-wins changed-ref/payload conflicts and same-ref/different-legacy conflicts make the later
  row an error even if the earliest row itself errors.
- The tenant advisory lock makes concurrent batches deterministic. Savepoint rollback plus identity
  re-read is still required for unique races with non-import writers. No conflict may leave partial
  children or a newly created pending person. Reimport after undo creates a new ticket; its rerun
  then skips.

## 7. References, state, figures, parents, and counters

### 7.1 Explicit references and aliases

`references.ts` loads only tenant-scoped active reference rows and builds normalized maps.

- Machine: normalize the supplied code, apply at most one configured machine alias, then require
  exactly one active machine. No recursive alias chase. Unknown/inactive target, inactive direct
  machine, or report without it is an error. Snapshot `{code,category,cell}` comes from that row.
- Person: collect names from reporter, state, events, edits, crew, segments, and reports. Apply at
  most one person alias. A configured target must be unique and active. Without an alias, query all
  active tenant people and compare `normalizeKey(name)`: one hit reuses it, multiple hits error,
  zero inserts `(team='production',kind='production',active=true,pending=true)` with trimmed,
  whitespace-collapsed original casing. Inactive-only names are unmatched. Cache by normalized name
  for the whole row; the tenant import lock prevents duplicate people across concurrent batches.
- Maintenance code: normalize, apply at most one separate maintenance-code alias, and require an
  active `list_item(list='maint_code')`. Unknown/inactive codes error; the original raw value stays
  in the raw envelope. Also require active supplied `work_type`, `location`, `wait_reason`,
  `breakdown_category`, and `observed_by` list items; pause `isVendor` must equal the wait reason's
  DB flag. Shift and transfer-to-shift codes must exist in `shift`.
- No report is dropped. A reference failure rolls back the entire ticket savepoint and is an
  explicit row/reconciliation issue. Pending names are committed only for successful imports and
  listed in stats.

### 7.2 Event/state reduction and exact DB mapping

Validate nondecreasing event times in input order; seq is array index `0..n-1`. Every event time and
non-expected-back interval is <= batch now. Exactly one `down` starts an ordinary timeline. Fold
events in seq order and reject a transition illegal in DOMAIN, including pause/resume,
transfer/pickup, running/stopped pairing, close from waiting, cancel/restore, late report, and edit
on cancelled tickets. Closed corrections must have `edit.at - closedAt <= 7 days` at edit time.
Equal event times are allowed but retain seq order. Initialize kind from the earliest kind mutation:
an upgrade implies initial support, otherwise the first `edit.kind.from` supplies it; with no kind
mutation use final kind. Use the same first-edit-from rule for initial machine/problem and down.at
for initial reportedAt, so edit old-values are checked without adding a second initial-state contract.

The fold sets/cross-checks:

- `down`: initial report time/status open. Without an edit, final `reportedAt=down.at`.
- `start`/`pickup`: working; `startedAt`, lead actor, and `segmentStartedAt`; pickup only after
  transfer. Start clears `handedOver` but retains historical handover target/since as runtime does.
  `selfStarted=true` requires first start (not pickup) at report time and matching supplied scalar.
- `join`: actor/role agrees with crew and a segment only while working. `leave` closes that person's
  crew/segment and applies the earliest-joined active-primary lead takeover rule.
- `pause`: waiting, reason/waitSince/pausedBy, expectedBackAt, and nonnull assignTo replaces the
  assignee (null retains it); closes all open segments. `resume`: working, resumer lead and segment
  start, clears waitReason/waitSince; other crew segments do not reopen.
- `transfer`: open/handedOver, handoverSince, target person or shift, increments transfers, clears
  lead/segment start. `update`: nonnull spare/expectedBackAt replaces the corresponding cache; null
  retains it, matching `COALESCE` persistence.
- `running`: stopped kind in working/waiting, sets runningAt and clears stoppedAt. `stopped` requires
  runningAt and sets stoppedAt. `upgrade_kind` requires an active support-before-upgrade timeline,
  final kind stopped, and sets `kindUpgradedAt` to that event time.
- `close`: working to closed; close actor comes from the close event, never the lead. Sets close
  time/kind/note. `cancel`: active to cancelled with exact previousStatus and cancelledAt.
  `restore`: returns to previousStatus, clears cancelledAt, sets segmentStartedAt at restore,
  restores waitSince only for waiting, and requires the supplied new lead segment for working.
- `report`: only closed no_report, changes final closeKind to report and requires the one report at
  that timestamp. `edit`: applies all scalar changes with old-value checks; latest seq-valid
  handsOn/waiting change wins, and `editedAt` is latest edit time. Latest reported/started/closed/
  problem/machine/kind/lead/closedBy changes must equal the supplied final scalars.

After the fold, require exact equality with supplied `status` and every `BhavinState` field. Require
reportedAt <= first start when started, startedAt <= closedAt when both exist, and closedAt no
earlier than the latest preceding non-edit event. After edits, every business timestamp (including
reported/started/closed/cancelled, crew, segment, and report submission) must be <= batch now;
only expectedBackAt may be future. Active open/working/waiting tickets use batch now for figures;
closed use `closedAt`; cancelled use `cancelledAt`. Open segments are allowed only in final working
state and must belong to the current
lead or a crew member who acted after resume. Closed/cancelled segments end at their terminal event.
Crew lead maps to DB `primary`; segment roles remain lead/primary/support.

Validate crew join/leave timestamps and reasons against events. Sort same-person segments by start;
reject inverted/zero-length, overlap (`next.start < prior.end`), or multiple open segments. Check
that every segment lies in a matching working stretch and its endReason matches the closing event.
Different-person overlap is explicitly accepted. Ordinary report doneBy/supportedBy sets must equal
people with lead/primary versus support segments; past breakdown is exempt because it has no live
segments.

`insert.ts` persists these exact remaining fields: `machine_snapshot` from the resolved machine;
`urgent=false`, `problem_lang=null`, `reported_by_role=null`, `raised_login_id=null`;
`raised_channel` per entry type; parent initially null then linked; task fields null; all nine figure
caches and `overrides`; `edited_at`; `last_event_seq=events.length-1`. Event rows retain type, seq,
time, resolved acting person, text and the validated payload (including previousStatus/edit
changes/isVendor), with `login_id` and `idempotency_key` null. Reports persist supplied local date,
shift, codes, figures, submittedBy/At, people, and set signature/pdf/approved/QR to null/null/null/
`{}`. DB `created_at/updated_at` metadata may use database now; no business timestamp may.

### 7.3 Figures and report-local validation

For ordinary rows, derive only `handsOnOverrideMin` and `waitingOverrideMin` from edit evidence.
For past breakdown, require exactly down+close, closed/report status, one report, no crew/segments/
edits/self-start, and set only `responseMin`, `repairMin`, and `downtimeMin` from that report. Never
turn an unexplained mismatch into an override.

Build domain events and work segments with resolved person IDs and call domain `figures()` once with
the derived overrides and `asOf`. (The baseline may be computed with `{}` only to report override
explanations.) Persist the resulting nine scalar caches and overrides. `perPerson` is calculated by
the domain function and tested but not stored as a tenth cache.

Compare each of the nine stored cache values and report downtime/response/repair against the final
result. Exact is `exactMatches++`; nonexact <=1 is a `warning` with stored/computed/delta and
`toleratedMismatches++`; >1 or null/type mismatch is an `error`, `hardMismatches++`, and row failure.
Each applied override emits an `info` issue and increments `overridesApplied` once per field, not per
comparison. A hard issue prevents insertion; it never merely makes an already committed ticket bad.

Validate report local fields with `Intl.DateTimeFormat` in the tenant time zone and the supplied
shift row. For initial close, `submittedAt=close.at`; for late report, `submittedAt=report.at`; for
past, `submittedAt=close.at`. In all three cases the report's `date` and `shiftCode` describe the
original `close.at`, not a later late-report submission. Validate that close time belongs to the
supplied shift and that `date` is its production date: local calendar date, minus one day when a
crosses-midnight shift has local time at/before its end. No shift inference is needed; the supplied
code is checked.

### 7.4 Parent graph

Load tenant ticket `(id,ref,parent_id)` and non-undone imported provenance before inserts. The
candidate map contains existing ticket ids plus symbolic row numbers for every eligible new import.
Resolve all declarations, including skipped rows and forward/backward in-file refs, into
`parentId`/`parentRowNumber`. Return parents before children (stable input-row tie-break), and at
runtime propagate any parent's reference/state/figure/SQL failure to all not-yet-processed
descendants as `parent_unavailable`. Then:

- Reject missing parent, self, conflicting existing parent, ambiguous provenance, and any candidate
  whose reachable parent chain is missing or cyclic. DFS with white/grey/black colors uses the
  planned parent map; every current declaration that reaches a cycle errors, not only the last row.
- A skipped prior synthetic import with null parent and a valid declared parent is a repair; the
  same nonnull parent is an idempotent no-op; a different parent is a conflict. A non-import
  pre-existing duplicate follows ruling 8 and is never changed.
- Apply planned inserts/updates only for successful rows. A graph-error new row is never inserted,
  cannot create a person, and is excluded from imported stats and ref maxima. A graph-error skipped
  row remains untouched in the DB. Cross-tenant refs cannot resolve; all lookups/updates carry
  tenant predicates and the existing composite parent FK is retained.
- `applyParentLinks` resolves symbolic parents through successful rows' `existingTicketId` and
  returns exact repairs for stats. Parent changes made by this batch are included in the completion
  fingerprint of tickets it imported.

### 7.5 Counters and sequences

`lockRefCounter` uses `pg_advisory_xact_lock(hashtext('ref-counter:' || tenantId || ':' || prefix))`.
For each prefix BD then WR after parent success, compute the maximum of:

1. existing `ref_counter.next_value - 1` (zero if absent);
2. numeric suffix of **every** existing tenant ticket matching `^prefix-[0-9]+$`; and
3. numeric suffix of each final successful imported/skipped ref in this file.

Upsert with `next_value=GREATEST(existing.next_value, observedMax+1)`. Error rows add nothing, but a
pre-existing skipped ticket is still covered by rule 2. Observed max 2,147,483,647 is fatal;
2,147,483,646 stores the exhausted sentinel 2,147,483,647, and a later allocation refuses rather
than reusing it. Undo does not touch counters. Imported seqs are zero based; runtime append uses
cached `last_event_seq+1`, not loaded array length.

## 8. Fingerprint and undo algorithm (task-11)

`BatchSnapshot.tickets` is a canonical array sorted by ticket UUID. Each item contains `rowNumber`,
`legacyId`, `entryType`, `ticketId`, and these exact fields (the full TypeScript shape is in §4.2):

- Ticket: every column selected by `TICKET_COLUMNS`, plus `paused_by_person_id` and `edited_at`.
  This explicitly includes parent, channel, all state/wait/handover/running/close/cancel fields,
  caches, overrides, and last seq. Exclude only DB `created_at`/`updated_at`.
- Events ordered by seq: `{seq,type,idempotencyKey,at,loginId,actingPersonId,text,payload}`.
- Crew ordered by id: `{id,personId,role,joinedAt,leftAt,leftReason}`.
- Segments ordered by id: `{id,personId,role,startedAt,endedAt,endReason}`.
- Reports ordered by id: `{id,machineId,date,shiftCode,problem,observedBy,correctiveAction,
downtimeMin,responseMin,repairMin,breakdownCategory,maintCode,spareUsed,rootCause,handoverName,
signatureFileId,pdfFileId,qrPayload,submittedByPersonId,submittedAt,approvedAt}` plus people
  ordered by person/role `{personId,role}`.

Dates use strict ISO strings and JSON object keys are canonicalized. A ticket digest is SHA-256 of
`canonicalJson(BatchTicketSnapshot)`. The overall digest is SHA-256 of canonical
`{version:1,tickets:[{ticketId,legacyId,entryType,digest},...]}` in ticket UUID order;
`emptyCompletionFingerprint()` is exactly `makeCompletionFingerprint({tickets:[]})`. Completion
snapshots include only `import_row.status='imported'`, never skipped/pre-existing tickets. An old
batch lacking a version-1 fingerprint or any expected ticket digest fails closed.

Undo runs in one `withTenant` transaction:

1. `SELECT ... FOR UPDATE` by `id=$batch AND tenant_id=$tenant AND source='bhavin'`; missing or
   cross-tenant is not found. Also require `stats->>'contract'='argus.synthetic-bhavin/v1'`. Reject
   `pending`, `running`, and `undone`; accept only done/failed.
2. Load imported rows and lock candidate tickets in UUID order with tenant predicates. Require all
   expected tickets to exist, each raw source_ref to match the fingerprint legacyId, and each
   ticket's channel to match its fingerprint entry type (`ordinary=import`,
   `pastBreakdown=backfill`). Recompute and compare every digest and the overall digest.
3. Refuse on any mismatch/later work, dangling provenance, or fingerprint absence. Refuse if any
   tenant ticket outside the candidate set has `parent_id` pointing to a candidate, if any tenant
   `file.ticket_id` references a candidate, or if any report signature/pdf file ref is nonnull.
4. Delete tenant-scoped `breakdown_report` rows first, then tenant-scoped candidate tickets; assert
   affected ticket count equals candidate count. Events/crew/segments/report people cascade. Do not
   delete persons or skipped/pre-existing tickets and do not alter counters/raw payloads/statuses.
5. Update only batch `status='undone'` (preserve original `finished_at` and stats). Insert one
   `audit_log` row with `login_id=null`, `action='import.undo'`, `entity='import_batch'`,
   `entity_id=batchId`, `ip=null`, `before={status,fingerprintDigest,ticketIds}`, and
   `after={status:'undone',deleted}`. Commit. Any error rolls back deletes, status, and audit.

## 9. Numbered Given/When/Then tests (all red before implementation)

The shared `import-fixture.ts` exports `makeSyntheticExport`, `makeOrdinaryTicket`,
`makeStoredFigures`, `seedSyntheticTenant`, IDs, and a `syntheticSource` constant. Its base closed
BD-0100 has down 10:00, start 10:05, close 11:00 on 2026-11-01Z, Asha lead 10:05–11:00 and Bina
support 10:30–11:00, so exact figures are response 5, active/repair 55, wait/vendor/handover/follow
0 or null as applicable, downtime/downAcc 60, Asha 55 and Bina 30. It uses invented aliases to M-1,
Asha, and M, a report dated 2026-11-01/shift 1/submitted 11:00, and no real data. The DB seeder
creates a UTC tenant, M-1, Asha/Bina, one vendor, required active lists, and shifts 1/2.

### task-10 — schema and bounds

1. **T01 (`import-schema.test.ts`) strict happy path:** Given the complete base export, when parsed
   and canonicalized twice with different object key insertion order, then all fields parse exactly,
   raw hashes match, array order remains significant, and no field defaults are introduced.
2. **T02 source gate:** Given sources `bhavin-v3`, `argus.synthetic-bhavin/v2`, null, and a missing
   source, when parsed, then each fails before a batch; only `argus.synthetic-bhavin/v1` succeeds.
3. **T03 NUL safety:** Given null raw, NUL in a top-level string, nested event text, alias key, and
   nested object key, when parsed, then each is rejected recursively with no raw property access
   throw and no database write.
4. **T04 strict calendars:** Given 2026-02-30, 2025-02-29 (valid only in 2024), 24:00, leap second,
   missing zone, `UTC`, bad offset, and invalid report date, when parsed, then each fails; valid Z,
   numeric offsets, milliseconds, and 2024-02-29 retain the represented instant/date.
5. **T05 required strict objects:** Given missing events/crew/segments/reports/state/selfStarted/
   storedFigures and an unknown key at every nesting level, when parsed, then every case fails;
   explicit nulls in allowed fields succeed.
6. **T06 enums and typed payloads:** Given arbitrary event type, `endReason:'done'`, invalid close/
   crew/segment role, mismatched event payload variant, and edit lookalike `activeMin`, when parsed,
   then each fails before SQL.
7. **T07 byte bounds:** Given exactly 262,144 and 262,145 canonical raw-ticket bytes and exactly
   65,536 and 65,537 event-payload bytes, when parsed, then exact caps pass and cap+1 fails.
8. **T08 collection bounds:** Given exact and +1 limits for tickets, events, crew, segments,
   reports, report people, edit changes, and each alias map, when parsed, then exact caps pass and
   every +1 fails with the collection path.
9. **T09 depth/string bounds:** Given depth 16/17 overall, payload depth 8/9, short strings 256/257,
   free text 4096/4097, legacyId 128/129, when parsed, then the first passes and second fails.
10. **T10 ref bounds:** Given BD/WR suffixes 1 and 2,147,483,646, zero, 2,147,483,647, negative,
    wrong prefix-kind pairing, and malformed refs, when parsed, then only the valid boundary refs
    and correct kind pairings pass.
11. **T11 report requiredness:** Given missing submittedAt/submittedBy/date/shift/downtime and a
    missing response/repair on past breakdown, when parsed, then all fail and no now/shift-A/zero/
    submitter default appears; nullable response/repair on ordinary report remain explicit null.
12. **T12 canonical identity:** Given a raw ticket plus aliases, when key order changes without
    semantic change and when ticket, alias, or array order changes, then only the first preserves
    identitySha256; rawSha256 changes only for ticket changes.

### task-11 — actual CLI and undo

13. **T13 (`import-cli.test.ts`, subprocess) app_api import success:** Given disposable Postgres and
    an app_api URL, when `pnpm import:bhavin ... --tenant cosmos` is spawned with APP_ENV=staging,
    then exit 0, stdout parses to the batch/stats, the batch is done, and exact imported row/ticket/
    figure/fingerprint data exists.
14. **T14 failed report:** Given a file with one valid, one malformed, then another valid ticket,
    when the real import subprocess runs, then exit 1, stdout reports failed with 2 imported/1
    errored and full issues, and the failed batch/raw rows persist.
15. **T15 source and file guards:** Given a non-synthetic source and separately a 5,242,881-byte
    file, when spawned with valid DB env, then each exits nonzero, emits no success report, and
    leaves zero batches; a 5,242,880-byte valid file reaches normal validation.
16. **T16 mode/production/args:** Given APP_ENV=production with and without confirmation, invalid/
    repeated flags, missing tenant, and invalid undo UUID with no DATABASE_URL, when real commands
    are spawned, then unconfirmed writes and all invalid args fail before DB work, confirmed staging/
    production writes proceed, and usage errors are exit 2.
17. **T17 role fail-closed:** Given owner/superuser and bypass-RLS URLs, when import or undo is
    spawned, then it rejects before tenant resolution and changes nothing; given a role-query error
    in a supplemental pure guard test, then it also rejects rather than warning.
18. **T18 tenant/source/provenance CLI undo:** Given tenant A and B and a B batch, when undo runs as
    A app_api, then it is not found and B is unchanged; given a pre-existing ticket linked to a
    `source='seed'` batch, then undo is rejected and that pre-existing ticket remains.
19. **T19 later-work CLI refusal:** Given a successful import followed by a real appended update,
    when undo is spawned, then it exits nonzero, deletes nothing, and writes no undo audit/status.
20. **T20 first/repeat CLI undo evidence:** Given an untouched successful import, when undo is
    spawned twice, then first exits 0 and second errors; reports/children are gone while raw rows,
    people, counter, original finished_at, and one before/after audit row remain exact.
21. **T21 (`import-undo.test.ts`) done/failed/backfill:** Given done and failed batches with an
    ordinary and past-breakdown ticket, when each first undo runs, then both channels are deleted,
    report-first deletion/cascades succeed, pre-existing skipped tickets survive, and raw/people/
    counter/finished/audit invariants hold.
22. **T22 terminal/state/legacy guards:** Given missing, pending, running, already undone, wrong
    tenant, non-Bhavin, no-fingerprint, wrong-provenance, and wrong-channel batches, when undo runs,
    then each fails closed without deletion.
23. **T23 complete fingerprint matrix:** Given an untouched batch and one independent mutation per
    case—ticket state/cache, event seq/payload, crew, segment/endReason, report scalar, report
    person, and parent—when undo runs, then every mutation is named in mismatch diagnostics and no
    candidate is deleted.
24. **T24 outside references:** Given an outside child ticket, a ticket file, and a report signature/
    pdf reference in separate cases, when undo runs, then it refuses and preserves both the batch
    and outside reference.
25. **T25 empty failed and stale skipped:** Given a failed zero-import batch with an empty valid
    fingerprint, when undone twice, then first returns 0/audits/marks undone and second rejects;
    given only skipped pre-existing rows, then no ticket is deleted.

### task-12 — pure mappings, state, and figures

26. **T26 (`import-reconcile.test.ts`) exact full mapping:** Given the base ticket with resolved
    references, when reconciled, then every state/cache/event/crew/segment/report/report-person
    field in §7.2 is exact, events are seq 0,1,2/last 2, close actor is the event actor, and figures/
    overrides match response 5, active/repair 55, downtime/downAcc 60, Asha 55/Bina 30.
27. **T26b (`import-state.test.ts`) statuses:** Given valid open-unstarted, working, waiting, closed
    report/no_report/done, cancelled, restored, and support-upgraded timelines, when reduced, then
    every final status/scalar agrees; any supplied scalar disagreement is an error.
28. **T27 handover/wait/running:** Given transfers to a person and next shift, pauses with assignee/
    ETA/vendor, updates with spare/ETA, running/stopped, upgrade, cancel/restore, and close actor
    different from lead, when reduced, then all handover counts/targets/since, wait fields, running/
    stopped/upgrade/cancel/close fields and last seq are exact.
29. **T28 illegal timelines:** Given reversed event times, future event, pause without working,
    resume without pause, stopped without running, repeated running, close from waiting, bad cancel
    previousStatus, late report from report close, and edit on cancelled, when reduced, then each
    fails with its event seq.
30. **T29 intervals:** Given the base different-person overlap, when figured, then active/repair is
    55 not 85 and per-person remains 55/30; given inverted, zero-length, same-person overlap,
    multiple open, open outside working, wrong endReason, and crew/event contradictions, then each
    is a row error while adjacent segments pass.
31. **T30 ordinary edits:** Given two chronological edits to handsOn/waiting with exact from/to and
    a later correction to close actor/problem/machine, when reconciled, then latest valid values win,
    only handsOn/waiting overrides exist, and all scalar edits map exactly; stale from values and
    response/repair/downtime lookalikes fail without inventing overrides.
32. **T31 tolerated/hard/null:** Given exact, one-minute wait difference, >1 unexplained active
    difference, stored null versus number, and wrong numeric type, when figured, then exact/warning/
    error outcomes and issue fields match, tolerated remains batch-eligible, hard/null/type fail,
    and no mismatch creates an override.
33. **T32 past breakdown:** Given a valid down+close past report, when reconciled, then channel is
    backfill, seqs are 0/1 and last=1, active is 0, response/repair/downtime are report overrides,
    other fields stay null/zero, and ordinary edit evidence cannot set those three overrides.
34. **T33 report figures:** Given exact, tolerated one-minute, >1, and null differences between
    report downtime/response/repair and final caches, when reconciled, then the same exact/warning/
    error rules apply to both stored cache and report comparisons with all differences listed.
35. **T34 local report fields and codes:** Given UTC day, positive/negative offsets, and a crosses-
    midnight shift in reference data, when validated, then supplied date/shift/production date must
    match exactly; unknown/inactive shift/workType/location/wait/category/observedBy/maint code or a
    pause isVendor disagreement fails without dropping the report.
36. **T35 report people/past constraints:** Given ordinary report people disagreeing with segment
    roles, duplicate/cross-listed names, missing report on close-report, report on active/done, or
    past with live segments/crew/edit, when reconciled, then each fails; valid past report people
    remain allowed without segments.

### integration — identity, graph, failures, counters, commands, artifacts

37. **T36 (existing `import.test.ts` test 1, retained and strengthened):** Given the original full/
    duplicate/malformed three-row scenario migrated only to the strict synthetic source/fields,
    when imported, then the original imported=1/skipped=1/errored=1, events=3/crew=2/segments=2
    assertions still pass, the new full stats equal the richer expected object, exact field values/
    ticket_id/report people/figures are verified, and batch is failed.
38. **T37 (existing test 2, retained):** Given the identical first file, when rerun, then original
    imported=0/skipped=2/errored=1 remains true, no duplicate ticket/person/child exists, and
    canonical skips link the same ticket.
39. **T38 (existing test 3, retained):** Given that first failed batch, when undone, then original
    deleted=1/batch undone/removal assertions pass plus raw, person, counter, finished_at and audit
    preservation; no original test is removed or made less specific.
40. **T39 (`import-integration.test.ts`) identity matrix:** Given same payload with reordered keys,
    changed ref, changed payload, changed aliases, imported ref/other legacy, pre-existing nonimport
    ref, in-file identical/conflicting duplicates, and undone reimport, when planned/imported, then
    §6.2 outcomes hold exactly with no partial rows/persons and stale skipped rows do not block
    reimport.
41. **T40 concurrent imports:** Given two pools importing identical files and separately conflicting
    same-legacy files concurrently, when Promise.all completes, then identical input yields one
    imported ticket and deterministic skips while conflict yields no duplicate/ambiguous identity;
    one pending person per normalized unmatched name and no savepoint-aborted batch remains.
42. **T41 aliases/report preservation:** Given normalized separate machine/person/maint aliases,
    N12-looking input without an alias, unknown/inactive machines, inactive targets, and a report
    with no ticket machine, when imported, then only configured active mappings resolve, every
    other case is an explicit row issue, and no report silently disappears.
43. **T42 people/vendor/14-vs-15:** Given 14 active known people, one configured vendor-team alias,
    one genuinely unmatched name, and duplicate active normalized names, when imported, then known/
    vendor aliases reuse their exact rows, only the unmatched name becomes the listed pending 15th
    production person, and ambiguity errors without creating another person.
44. **T43 parents:** Given forward/backward declarations on imported and skipped rows, same-parent
    rerun, a linked import whose parent_id is administratively cleared then rerun, conflict, missing,
    self, two/multi-node cycle, cross-tenant parent, and a new parent whose machine reference fails,
    when imported, then valid links/repairs are exact and idempotent, the cleared parent is restored,
    the failed parent's descendants become parent_unavailable rather than fatal, every invalid
    imported child is absent from DB/stats/max, and every pre-existing skipped ticket stays
    untouched.
45. **T44 raw/ticket savepoints and fatal:** Given a forced raw-insert SQL error, a trigger raising
    SQLSTATE 23514 for the middle of three otherwise valid tickets, and separately a one-time finish-
    batch trigger failure, when imported, then raw failure creates a minimal safe error row, middle
    ticket failure rolls back all its children/new people while outer valid rows persist, and fatal
    failure rolls back all main work yet persists failed/finished/fatal stats before rethrow.
46. **T45 counters:** Given a higher pre-existing BD ref absent from the file, both BD/WR imports,
    malformed/parent-error higher refs, an already-high counter, concurrent allocation, undo, and
    suffix 2,147,483,646/2,147,483,647, when advanced/allocated, then max+1/GREATEST/exhaustion rules
    hold, errors do not advance, allocation serializes, and undo never lowers either counter.
47. **T46 (`import-commands.test.ts`) subsequent commands:** Given imported open, working, waiting,
    running, cancelled, and no-report tickets, when real authenticated HTTP start, update, machine-
    running, machine-stopped, resume, cancel, restore, and late-report calls run, then each succeeds
    under its valid state, appended seq equals prior last+1 (first start after down is [0,1]), and
    cached last/figures match the database.
48. **T47 existing command suite + immediate raise:** Given the existing `tickets-commands.test.ts`
    scenarios and an imported BD maximum, when the entire file plus a real HTTP BD raise runs, then
    every original assertion remains green, the new ref is importedMax+1 with no unique collision,
    and no WR raise flow appears.
49. **T48 parity source (`tools/parity.test.ts`):** Given PARITY.md containing exactly one
    `v3.import.01` source row, when `tools/sync-parity.ts` regenerates and `pnpm parity` validates,
    then feature/disposition/milestone match, status remains in-progress with actual synthetic test
    evidence/no PR #68, expected_rows is generated from rows.length, and a missing/changed source
    row or manually inconsistent ledger fails.
50. **T49 artifact truthfulness:** Given the completed diff and actual branch/CI state, when
    HANDOFF/STATUS/CHANGELOG are inspected, then HANDOFF has fewer than 50 physical lines, merged
    and in-flight facts are distinguished, no nonexistent PR is cited, and every import statement
    says synthetic-only with real N1/schema/cutover external.
51. **T50 final full regression:** Given all preceding focused tests and the unchanged pre-existing
    suite, when `pnpm verify`, `pnpm test:e2e`, `pnpm pr:size`, and the diff audit run, then all pass
    with the stated size label, no skipped/deleted test, no dependency/migration, every file/function
    within budget, and HANDOFF below 50 lines/STATUS factually corrected.

## 10. Parity and artifact correction

Add a `**Import and cutover (SPEC 1.10)**` table to `PARITY.md` with an explicit first cell
`v3.import.01`, feature “Import Bhavin's live ticket store JSON with events, crew, reports, reviewed
aliases, figure reconciliation, reference counters, and reversible undo”, disposition `keep`, and
milestone `M1`. `tools/parity.ts` exports
`parseImportSourceRow(markdown: string): Pick<ParityRow,'id'|'feature'|'disposition'|'milestone'>`
and changes the validator signature to
`validateParity(file: ParityFile, markdown = readFileSync('docs/spec/PARITY.md','utf8')): string[]`;
it validates the source row in addition to the existing checks. Thus `check-parity.ts` continues to
call `validateParity(file)` and is not otherwise changed.

Run `pnpm tsx tools/sync-parity.ts`. That tool reads PARITY.md and the current YAML, upserts only
`v3.import.01` from the source row, preserves other rows, sets `expected_rows` programmatically to
`rows.length`, and writes
using the installed `yaml` package. The row stays `in-progress`, cites real test IDs only, and its
`external_reason` says the real N1 export/Worker schema/compatibility and cutover remain external.
No hard-coded 79/80 increment and no PR number are used. Validation compares source and ledger so a
future ledger-only edit fails.

At implementation end, rewrite `HANDOFF.md` to fewer than 50 physical lines with actual branch/test/
review state, correct `STATUS.md` to actual merged versus in-flight facts and the synthetic-only
boundary, and add a CHANGELOG entry that explicitly avoids a real compatibility/cutover claim.
Mention a real PR only after it exists; test evidence does not require one.

## 11. Verification, reviews, and out of scope

1. Each task commits/tests red before green within its scope; integration proves every new test can
   fail against the corresponding old behavior. Never delete, skip, rename to evade, snapshot-over
   a failure, loosen an assertion, or reduce an existing fixture to make the suite pass.
2. Run focused tests, then `pnpm verify`, `pnpm test:e2e`, and `pnpm pr:size`; inspect `git diff
--check`, changed-file scope, dependency diff, and line/function budgets. Confirm no migrations,
   real data/secrets, `command_idempotency` writes, or non-synthetic source acceptance.
3. Before implementation the lead obtains an independent scoped plan re-review. Before merge the
   R3 ladder requires fresh architecture, schema/contract, code, adversarial security, test/lean,
   and data/parity reviews with file:line evidence. Human security sign-off remains required before
   any real cutover; synthetic green tests do not authorize cutover.
4. Explicitly out of scope: N1/Worker acquisition and semantics confirmation, the real
   `bhavin-export.schema.json`, real alias decisions/N12, real compatibility, zero-unexplained-
   mismatch claim on real data, seed-report changes, cutover/revert runbook, production execution,
   migration/RLS redesign, generic isolation-list rewrite, analytics/Excel/PM/PDF import, WR raising,
   and every unrelated ticket/domain refactor.
