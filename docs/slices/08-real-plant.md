# 08 — Real plant in

Issue: [#78](https://github.com/nimishshah1989/argus/issues/78) · Blocked by: 01 · Branch `claude/t08-real-plant`.
One PR, body contains `Closes #78`. No table, no migration, no new npm dependency.

## 1. Goal

The Cosmos tenant opens with the plant's real 192 machines, its 26 logins and both shift windows, and an event
at 18:29 counts in shift 2.

## 2. Decisions

1. **Machines.** `apps/server/src/seed/registers-to-json.py` is run by hand, never in CI. It is not in any package
   manifest, so it needs no ADR. It uses openpyxl 3.1.5 (`python3 -m pip install openpyxl==3.1.5`) and runs as
   `python3 -I apps/server/src/seed/registers-to-json.py <xlsx> apps/server/src/seed/generated/cosmos-machines.json`.
   - **Input.** It reads the sheets `CNC Machine Master`, `Conventional Machines`, `Process Machines`, `DG Sets`
     and `Utilities`. The header row is the first row whose first cell starts with `Sr.`. The id column is
     `Machine ID`, or `DG ID` on `DG Sets`.
   - **Output.** It writes `{sheetCounts, machines: MachineSeed[]}`.
   - **Segment** comes from the sheet:
     - on the CNC sheet, `Robot` when Category is `Robot`, else `CNC`;
     - the other sheets give `Conventional`, `Process`, `DG` and `Utility`;
     - the CNC sheet's own `Segment` column is ignored.
   - **Field map.** Category, Make, Model, `Serial No`, Controller, `Ctrl Model`, `Ctrl Sr No`, Year (int),
     `Date of Purchase` (`YYYY-MM-DD`), `Power(KVA)` → `powerKw` (as today), Location, Cell, `Asset Code`,
     `Capacity(KVA)` → `capacityKva`.
   - **Values.** Text is trimmed. A blank, `None` or non-numeric value becomes `null`. Length, Width, Age,
     Efficiency and Conveyor are dropped, as today.
   - **Failures.** It exits non-zero on a missing sheet, a missing header or a duplicate id.
   - **After running it,** run `pnpm prettier --write` on the output. Because the script is hand-run, its failure
     paths are not tested.
2. **Paths.** `tools/check-pr-size.ts` skips `generated/` and `fixtures/`, so the large files live at:
   - `apps/server/src/seed/generated/cosmos-machines.json`;
   - `apps/server/src/seed/fixtures/cosmos-people.fixture.json`;
   - `apps/server/src/seed/cosmos-shifts.json`.

   `cosmos.ts` resolves all three with `fileURLToPath(new URL('./<relative path>', import.meta.url))`
   (for example `new URL('./generated/cosmos-machines.json', import.meta.url)`) and exports them as
   `SEED_FILES = { machines, shifts, peopleFixture }`. Tests import `SEED_FILES`.

3. **People fixture.** It has the same shape as `users.json`. The real usernames are first names, so the fixture
   uses `person01` to `person26` and the names `Person 01` to `Person 26`.
   - Entries 01–14 are `maint`: 01–07 have `shift: "1"`, 08–14 have `shift: "2"`.
   - Entries 15–25 are `report`, and 26 is `admin`.
   - Every entry has `phone: "+9199999000NN"` (NN = its number), `title: ""`, `active: true`, `shared: false`,
     `locked: false` and `devices: 0`.
   - `created`, `lastLogin` and `seen` are all `"2026-01-01T00:00:00.000Z"`.
4. **Where the seed lives (orchestrator ruling).** Nothing under `packages/` or `scripts/` may import from
   `apps/server`, so the Cosmos seed moves into `apps/server/src/seed/` (`git mv` for the two `.ts` files, so
   history follows). `apps/server` already depends on `@node-rs/argon2` and `pg`, so no dependency is added.
   - `cosmos.ts` imports `hashPassword` from `../auth.js` (a re-export shim once ticket 02 lands).
   - The seed hashes the password once, before `BEGIN`, and all logins use that hash.
   - `package.json` `seed:cosmos` becomes `tsx apps/server/src/seed/cosmos.ts`. `main` keeps resolving the
     `docs/discovery` paths and the report path from `process.cwd()`, which is the repo root under pnpm.
   - **The server build does not bundle the seed.** `scripts/build-server.ts` bundles from the single entry
     `apps/server/src/index.ts`, and nothing in the server imports `seed/`, so esbuild never reaches it (checked:
     no file in `apps/server/src` mentions the seed today). `scripts/build-server.ts` is not changed. The gate
     (§6) proves it after the build.
5. **Order inside `seedCosmos`.**
   1. Check the password rule.
   2. Load and validate the files, and run `buildSeed`.
   3. Hash the password.
   4. Connect, then `BEGIN`, then delete the tenant and insert everything.

   So any failure in steps 1 to 3 leaves the existing tenant untouched.

6. **Password source.** If `peoplePath` is given, `initialPassword` is required. Without `peoplePath`, the seed uses
   `SEED_FILES.peopleFixture` and `FIXTURE_PASSWORD`, which is for dev and CI only. `main` passes
   `process.env.SEED_PEOPLE_FILE` and `process.env.SEED_INITIAL_PASSWORD`.
7. **Exact strings.**
   - **Missing password:** `seed: SEED_INITIAL_PASSWORD is required with a people file`.
   - **No users array:** `seed: people file has no users array`.
   - **Bad entry:** `seed: people entry <i> is invalid (<field>)`.
     - `<i>` is 0-based.
     - Fields are checked in the order `username`, `name`, `role`, and the first failure is reported.
     - `username` and `name` must be non-empty strings, and `role` must be a key of `ROLE_MAP`.
     - No message ever contains a name, username or phone.
   - **Shift names** come from the data file: `Shift 1`, `Shift 2`.
   - **Conflicts** (from `machineConflicts`, in this order; a line is written only when its list is non-empty):
     - `CNC Machine Master has 126 rows: 125 CNC + 1 Robot (own segment).`
     - `In the 11 Nov registers but not the 28 Oct export: VC-57.`
     - `In the 28 Oct export but not the 11 Nov registers: <codes>.`
     - `Blank make, model or serial in <segment>: <codes>.` One line per segment, in the order CNC,
       Conventional, Process, Utility, DG, Robot.
     - Codes keep file order and are joined with `, `.
     - The old ids are the union of `exp.machines`, `conv`, `proc`, `util` and `dg`.
   - **People line:** `26 logins (14 technician, 11 operator, 1 admin) + 1 vendor person (Imptex Team) without a login.`
     - The codes, Q8 and glossary lines are kept.
     - These lines are deleted: the VC-57 blank-nameplate line, the Robot/live-config line and the 191/192 line.
   - **`SeedReport.sources`:**
     1. `exportPath`, `livePath`, `glossaryPath`;
     2. `SEED_FILES.machines`, `SEED_FILES.shifts`;
     3. `SEED_FILES.peopleFixture` when there is no `peoplePath`, else the literal `people file (outside repo)`.
        The real path is never listed.

     `main` prints the same entries, with repo-relative paths for files inside the repo.
8. **Shift at 18:29.** `shiftAt` orders matches by `starts_at DESC`, because DOMAIN line 207 gives the overlap to
   the later shift. Between 05:00 and 08:00 no shift matches, so the existing fallback `'1'` stays.
   `currentShift` becomes `shiftAt(client, tenantId, new Date())`.

## 3. Files

| File                                                                         | Change                                                                                                                                                                                                       |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/server/src/seed/registers-to-json.py`                                  | New (decision 1), under 80 lines.                                                                                                                                                                            |
| `apps/server/src/seed/generated/cosmos-machines.json`                        | New, generated. `sheetCounts`: CNC Machine Master 126, Conventional Machines 16, Process Machines 17, DG Sets 3, Utilities 30.                                                                               |
| `apps/server/src/seed/fixtures/cosmos-people.fixture.json`                   | New (decision 3).                                                                                                                                                                                            |
| `apps/server/src/seed/cosmos-shifts.json`                                    | New: `[{code:'1',name:'Shift 1',startsAt:'08:00',endsAt:'18:30',crossesMidnight:false},{code:'2',name:'Shift 2',startsAt:'18:29',endsAt:'05:00',crossesMidnight:true}]`.                                     |
| `apps/server/src/seed/cosmos-data.ts` (`git mv` from `scripts/seed-data.ts`) | Delete `ExportMachine`, `toInt`, `machineSeed`, the old `buildMachines` and `buildShifts`. Add `PeopleEntry`, `SeedFiles`, `ROLE_MAP`, `machineConflicts`, and a new `buildPeople`. Change `buildSeed` (§4). |
| `apps/server/src/seed/cosmos.ts` (`git mv` from `scripts/seed-cosmos.ts`)    | Add `SEED_FILES` and `FIXTURE_PASSWORD`. Make the changes in §4 and decisions 5–7.                                                                                                                           |
| `package.json`                                                               | `seed:cosmos` script path only (decision 4).                                                                                                                                                                 |
| `apps/server/src/auth.ts`                                                    | Add the exported `hashPassword`, and make line 216 call it.                                                                                                                                                  |
| `apps/server/src/ticket-report.ts`                                           | Add the exported `shiftAt`. `currentShift` becomes a one-line body. No other line moves.                                                                                                                     |
| `apps/server/test/cosmos-seed.test.ts`                                       | New: tests 1–8.                                                                                                                                                                                              |
| `packages/db/test/cosmos-seed.test.ts`                                       | Deleted on purpose: tests 1–8 replace it, and are stricter. This is not a weakened test.                                                                                                                     |
| `apps/server/test/cosmos-plant.test.ts`                                      | New: tests 9–10.                                                                                                                                                                                             |
| `docs/plan/seed-report.md`                                                   | Regenerated by `pnpm seed:cosmos` in fixture mode.                                                                                                                                                           |
| `changes/78-real-plant.md`                                                   | `- Cosmos seeds its real machine registers, 26 logins (fake in CI) and both shifts; 18:29 is shift 2.`                                                                                                       |

## 4. Interfaces

```ts
// apps/server/src/seed/cosmos-data.ts
export interface PeopleEntry {
  username: string;
  name: string;
  role: string;
  title?: string;
  phone?: string;
  shift?: string;
}
export interface SeedFiles {
  machines: { sheetCounts: Record<string, number>; machines: MachineSeed[] };
  shifts: SeedResult['shifts'];
  people: { users: PeopleEntry[] };
}
export const ROLE_MAP = {
  maint: { role: 'technician', team: 'maintenance', kind: 'staff' },
  report: { role: 'operator', team: 'production', kind: 'production' },
  admin: { role: 'admin', team: 'maintenance', kind: 'staff' },
} as const;
export interface PersonSeed {
  name: string;
  team: string;
  kind: string;
  title: string | null;
  phone: string | null;
  defaultShift: string | null;
  login: { username: string; role: string } | null;
}
// file people first (title '' -> null, missing phone/shift -> null), then exportTeam entries with type 'Vendor'
// (team/kind 'vendor', login null); teamShifts = { name: shift } for file entries that have a shift
export function buildPeople(
  users: unknown,
  exportTeam: Array<{ name: string; type: string; status: string }>,
): { people: PersonSeed[]; teamShifts: Record<string, string> }; // throws per decision 7
export function machineConflicts(
  exp: Record<string, unknown>,
  machines: SeedFiles['machines'],
): string[];
// SeedResult gains teamShifts; machines = files.machines.machines; shifts = files.shifts
export function buildSeed(exp, live, glossary, files: SeedFiles): SeedResult;
// apps/server/src/seed/cosmos.ts
interface Paths {
  exportPath: string;
  livePath: string;
  glossaryPath: string;
  peoplePath?: string;
}
export const SEED_FILES: { machines: string; shifts: string; peopleFixture: string };
export const FIXTURE_PASSWORD = 'fixture-only-password';
async function insertPeople(
  client: PoolClient,
  tenantId: string,
  people: PersonSeed[],
  passwordHash: string,
): Promise<void>;
//   person INSERT (name, team, kind, title, phone, default_shift, active=true) RETURNING id; then the login if any
async function insertSettings(
  client: PoolClient,
  tenantId: string,
  teamShifts: Record<string, string>,
): Promise<void>;
export async function seedCosmos(
  pool: Pool,
  paths: Paths,
  initialPassword?: string,
): Promise<SeedReport>;
// apps/server/src/auth.ts
export function hashPassword(password: string): Promise<string>; // hash(password, PASSWORD_OPTS)
// apps/server/src/ticket-report.ts
export async function shiftAt(client: PoolClient, tenantId: string, at: Date): Promise<string>;
// ($2::timestamptz AT TIME ZONE (SELECT time_zone FROM tenant_info($1)))::time; same WHERE; ORDER BY starts_at DESC LIMIT 1; fallback '1'
```

## 5. Data (existing columns only)

- **`machine`:** the same 17 columns as today.
- **`person`:**
  - `name`, `team`, `kind`, `title`, `phone`, `default_shift`, and `active = true`;
  - the vendor person's title, phone and shift are `null`.
- **`login`:**
  - `person_id`, `username`, `role`;
  - `password_hash` (argon2id);
  - `shared` false, `must_change_password` true, `disabled_at` null, `cell` null.
- **`shift`:** from `cosmos-shifts.json`.
- **`setting.team_shifts`:** jsonb `{name: shift}`, built from the people file.
- **Report `counts`:**
  - `machines` 192;
  - `segment_CNC` 125, `segment_Robot` 1, `segment_Conventional` 16, `segment_Process` 17, `segment_DG` 3,
    `segment_Utility` 30;
  - `people` 27, `logins` 26;
  - all other counts unchanged.

## 6. Test cases (each fails before the change)

`apps/server/test/cosmos-seed.test.ts` (imports `seedCosmos`, `SEED_FILES` and `FIXTURE_PASSWORD` from `../src/seed/cosmos.js`): one `startTestDb`, seeded with `seedCosmos(db.admin, paths)` in fixture mode, where `paths` holds the three
`docs/discovery` files. Assertions query `db.admin`.

1. `loads every register machine by segment`
   - **Given** the seed, and **When** reading `SEED_FILES.machines` and counting machines per segment.
   - **Then** the counts are `{CNC:125, Conventional:16, DG:3, Process:17, Robot:1, Utility:30}`.
   - CNC + Robot equals `sheetCounts['CNC Machine Master']`, and each other segment equals its own sheet count.
   - Each `report.counts.segment_*` matches its segment.
   - The number of machines with a non-null `cell` equals the number in the JSON, and VC-57's `cell` equals its JSON value.
2. `VC-57 carries its nameplate`
   - **Then** VC-57's `make`, `model` and `serial` are all non-null.
3. `seed report lists register differences`
   - **Then** `conflicts` contains `In the 11 Nov registers but not the 28 Oct export: VC-57.` and
     `CNC Machine Master has 126 rows: 125 CNC + 1 Robot (own segment).`
   - No line contains `nameplate fields left blank`.
   - `sources` ends with `SEED_FILES.peopleFixture`.
4. `seeds 26 logins with roles, each tied to its own person`
   - **Then** the roles are `{technician:14, operator:11, admin:1}`.
   - There are 26 distinct non-null `person_id` values, and 27 persons, one of them a `vendor` with no login.
   - Every login has `must_change_password` true, `shared` false, `disabled_at` null, and a `$argon2id$` hash.
   - Every non-vendor name matches `/^Person \d{2}$/`.
   - All 26 phones match `/^\+9199999000\d{2}$/`.
5. `team shifts and default shifts come from the people file`
   - **Then** `team_shifts` equals the fixture's name→shift map, which has 14 keys.
   - Each maintenance person's `default_shift` equals their fixture entry.
6. `shifts are the data file's windows and re-seeding is idempotent`
   - **Then** the rows are exactly `1, Shift 1, 08:00:00, 18:30:00, false` and `2, Shift 2, 18:29:00, 05:00:00, true`.
   - **After a second seed:** 192 machines, 26 logins, 27 persons and 144 glossary terms.
7. `a people file needs an initial password`
   - **Given** `peoplePath = SEED_FILES.peopleFixture` and no password.
   - **Then** the seed rejects with the exact missing-password message, and 26 logins remain.
   - **Given** the same path and `FIXTURE_PASSWORD`, **Then** `sources` contains `people file (outside repo)` and
     not the path.
8. `an invalid people entry is rejected without leaking values`
   - **Given** a temporary copy of the fixture (in an `mkdtemp` directory) where entry 3 has no `role`.
   - **Then** the seed rejects with exactly `seed: people entry 3 is invalid (role)`.
   - The message contains neither `person` nor `+91`.
   - 26 logins and 192 machines remain.

`apps/server/test/cosmos-plant.test.ts`: `startTestDb`, then `seedCosmos(db.admin, paths)`, then `buildApp` on `db.app`. The
`tenantId` comes from `SELECT id FROM tenant WHERE slug = 'cosmos'` on `db.admin`.

9. `a seeded login signs in`
   - **When** `POST /api/v1/auth/login` with host `cosmos.localhost`, user `person01` and `FIXTURE_PASSWORD`,
     **Then** the answer is 200 with a token.
   - **With a wrong password,** the answer is 401.
10. `an event at 18:29 falls in the later shift`
    - Each instant is checked with `withTenant(db.app, tenantId, (c) => shiftAt(c, tenantId, at))`.

    | Instant                     | Shift            |
    | --------------------------- | ---------------- |
    | `2026-11-13T18:28:00+05:30` | `'1'`            |
    | `2026-11-13T18:29:00+05:30` | `'2'`            |
    | `2026-11-13T18:30:00+05:30` | `'2'`            |
    | `2026-11-14T04:59:00+05:30` | `'2'`            |
    | `2026-11-14T05:00:00+05:30` | `'1'` (fallback) |

**Gates:** `pnpm pii:scan` passes over the fixture and the generated JSON. After `pnpm build:server`,
`grep -cE 'seedCosmos|cosmos-machines' apps/server/dist/server.mjs` prints `0`. `pnpm verify` is green.

## 7. Out of scope and regression risk

**Out of scope:**

- tickets (ticket 09) and the staging deploy (ticket 13);
- the `active` and `locked` flags from the people file;
- shared floor logins;
- a third shift (Q8), and who owns 18:29 (N11, which would be a data change);
- `MILESTONES.md` and `ledger.md`.

**Regression risks and the tests that guard them:**

- `currentShift` now uses the app's clock, so a report's default shift could change. Guarded by
  `apps/server/test/ticket-report.test.ts` and `apps/server/test/ticket-pdf.test.ts`.
- The password-change route now goes through `hashPassword`. Guarded by `apps/server/test/auth.test.ts`.
- The old export's 13 maintenance people are no longer seeded, and operators are now `team = 'production'`.
  Guarded by tests 4–5.
- The seed moved into `apps/server/src/seed/` and imports `../auth.js`. Guarded by tests 1 and 9, and by the
  build gate (the seed stays out of `server.mjs`).

## 8. Questions

1. (Nimish, not blocking) The real user list has no shifts. On staging, people get no default shift unless the
   staging copy of the file adds a `shift` for each maintenance person. Should it?

Note: staging persons have no phone until a phone source exists.

## 9. Amendments after ticket 02 merged (orchestrator ruling)

- The seed's SQL on module-owned tables lives in `modules/identity/repo.ts` (`deleteTenantBySlug`, `insertTenant`, `insertPeople`) and `modules/plant/repo.ts` (`insertSegments`, `insertMachines`, `insertListItems`, `insertShifts`, `insertSettings`, `insertGlossaryTerms`), exported through each module's `index.ts`; `cosmos.ts` only orchestrates. This is required by `pnpm boundaries`. `insertSettings` takes `Array<[key, value]>`.
- `hashPassword` lives in `modules/identity/routes.ts` and is exported from the identity `index.ts`; `auth.ts` stays the one-line shim.
- The parity row that named the old `packages/db` seed test now names `apps/server/test/cosmos-seed.test.ts`.
