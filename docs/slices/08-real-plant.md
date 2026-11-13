# 08 — Real plant in

Issue: [#78](https://github.com/nimishshah1989/argus/issues/78) · Blocked by: 01 · Branch `claude/t08-real-plant`.
One PR, body contains `Closes #78`. No table, no migration, no new npm dependency.

## 1. Goal

The Cosmos tenant opens with the plant's real 192 machines, its 26 logins and both shift windows, and an event
at 18:29 counts in shift 2.

## 2. Decisions (technical; recorded, not reopened)

1. **Machines.** `registers-to-json.py` (openpyxl, run by hand, never in CI) reads the five sheets of the 11 Nov xlsx
   (header row = the row whose first cell starts `Sr.`; id column `Machine ID`, or `DG ID` on `DG Sets`) and
   writes `{sheetCounts, machines: MachineSeed[]}`. Segment comes from the sheet (CNC sheet: `Robot` when
   Category is `Robot`, else `CNC`; `Conventional`, `Process`, `DG`, `Utility`); the CNC `Segment` column is
   ignored. Map: Category, Make, Model, `Serial No`, Controller, `Ctrl Model`, `Ctrl Sr No`, Year (int), `Date of
Purchase` (`YYYY-MM-DD`), `Power(KVA)` → `powerKw` (as today), Location, Cell, `Asset Code`, `Capacity(KVA)` →
   `capacityKva`. Trimmed; blank, `None` or non-numeric → `null`. Length, Width, Age, Efficiency, Conveyor are
   dropped (as today). It fails loudly on a missing header, a duplicate id or a missing sheet. Run it, then
   `pnpm prettier --write` the output.
2. **File locations (deviation, please confirm).** `tools/check-pr-size.ts` caps a PR at 800 changed code lines and
   skips only `fixtures/` and `generated/` paths. The pretty-printed machines JSON is about 3,500 lines, so it
   lives at `scripts/seed/generated/cosmos-machines.json`. The people fixture lives at
   `scripts/seed/fixtures/cosmos-people.fixture.json`. `cosmos-shifts.json` stays at `scripts/seed/`.
3. **Usernames are PII.** All 26 real usernames are the person's first name. So the fixture uses `person01` to
   `person26` with names `Person 01` to `Person 26`, never a real username. Entries 01–14 are `maint` (01–07
   `shift: "1"`, 08–14 `shift: "2"`), 15–25 are `report`, and 26 is `admin`. Every entry has
   `phone: "+9199999000NN"` (NN = 01..26), `title: ""`, `active: true`, `shared: false`, `locked: false`,
   `devices: 0`, and `created`/`lastLogin`/`seen` set to `"2026-01-01T00:00:00.000Z"`.
4. **Hashing.** The repo root cannot resolve `@node-rs/argon2` (it is only in `apps/server/node_modules`).
   Adding it to the root would be a new dependency, so `auth.ts` exports `hashPassword`, and
   `seed-cosmos.ts` imports it from `../apps/server/src/auth.js` (precedent: `tools/import-bhavin.ts`). One
   hash per seed run is shared by all logins: the password is the same for all of them and must be changed at
   first sign-in.
5. **Password source.** If `peoplePath` is given, `initialPassword` is required; without it the seed throws before
   any write. Without `peoplePath` the seed uses the fixture and `FIXTURE_PASSWORD`. The fixture is for
   dev and CI only: staging always sets `SEED_PEOPLE_FILE` and `SEED_INITIAL_PASSWORD`.
6. **People file validation (trust boundary).** Each entry must have a non-empty `username`, a non-empty `name` and
   a `role` in the role map. Otherwise the seed throws `seed: people entry <index> is invalid (<field>)`.
   Messages never contain a name, username or phone. `title: ""` → `null`; a missing `phone` or `shift` → `null`.
7. **Shift at 18:29.** `shiftAt` orders matches by `starts_at DESC` (DOMAIN line 207: the overlap goes to the later
   shift). Between 05:00 and 08:00 nothing matches, and the existing fallback `'1'` stays. `currentShift`
   becomes `shiftAt(client, tenantId, new Date())`, so the clock is the app's, not `now()` in the database.

## 3. Files

| File                                               | Change                                                                                                                                                                                                                                                                                                                                                                                                                         |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `scripts/seed/registers-to-json.py`                | New: `python3 -I scripts/seed/registers-to-json.py <xlsx> <out.json>`, per decision 1. Under 80 lines.                                                                                                                                                                                                                                                                                                                         |
| `scripts/seed/generated/cosmos-machines.json`      | New, generated: `sheetCounts` = CNC Machine Master 126, Conventional Machines 16, Process Machines 17, DG Sets 3, Utilities 30; 192 machines.                                                                                                                                                                                                                                                                                  |
| `scripts/seed/fixtures/cosmos-people.fixture.json` | New, per decision 3.                                                                                                                                                                                                                                                                                                                                                                                                           |
| `scripts/seed/cosmos-shifts.json`                  | New: the two shifts exactly as in the ticket (codes `1`, `2`).                                                                                                                                                                                                                                                                                                                                                                 |
| `scripts/seed-data.ts`                             | Delete `ExportMachine`, `toInt`, `machineSeed`, the old `buildMachines` and `buildShifts`. Add `PeopleEntry`, `SeedFiles`, `ROLE_MAP`, `buildPeople(users, exportTeam)` (fixture/real people, then the export team's `Vendor` entries only). Add `machineConflicts`. Change `buildSeed`'s signature, its counts and its conflicts (§4, §5).                                                                                    |
| `scripts/seed-cosmos.ts`                           | `Paths` gains `peoplePath?`. Load the three seed files. `insertPeople` inserts each person `RETURNING id`, then its login. `insertSettings` takes `seed.teamShifts`. `seedCosmos` gains `initialPassword?`. `main` reads `SEED_PEOPLE_FILE` and `SEED_INITIAL_PASSWORD`, and the report's Sources list the new files (the people source prints as `fixture` or `SEED_PEOPLE_FILE`, never the path). Export `FIXTURE_PASSWORD`. |
| `apps/server/src/auth.ts`                          | Add exported `hashPassword`. Line 216 calls it. Nothing else changes.                                                                                                                                                                                                                                                                                                                                                          |
| `apps/server/src/ticket-report.ts`                 | Replace the `currentShift` body only (decision 7) and add exported `shiftAt`. No other line moves (another ticket is moving this file).                                                                                                                                                                                                                                                                                        |
| `packages/db/test/cosmos-seed.test.ts`             | Rewritten to tests 1–7.                                                                                                                                                                                                                                                                                                                                                                                                        |
| `apps/server/test/cosmos-plant.test.ts`            | New: tests 8–9.                                                                                                                                                                                                                                                                                                                                                                                                                |
| `docs/plan/seed-report.md`                         | Regenerated by `pnpm seed:cosmos` (fixture mode).                                                                                                                                                                                                                                                                                                                                                                              |
| `changes/78-real-plant.md`                         | `- Cosmos seeds its real machine registers, 26 logins (fake in CI) and both shifts; 18:29 is shift 2.`                                                                                                                                                                                                                                                                                                                         |

## 4. Interfaces

```ts
// scripts/seed-data.ts
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
// SeedResult gains teamShifts: Record<string, string> (name -> shift, only entries with a shift)
export function buildSeed(exp, live, glossary, files: SeedFiles): SeedResult; // throws on an invalid people entry
// scripts/seed-cosmos.ts
interface Paths {
  exportPath: string;
  livePath: string;
  glossaryPath: string;
  peoplePath?: string;
}
export const FIXTURE_PASSWORD = 'fixture-only-password';
export async function seedCosmos(
  pool: Pool,
  paths: Paths,
  initialPassword?: string,
): Promise<SeedReport>;
// apps/server/src/auth.ts
export function hashPassword(password: string): Promise<string>; // hash(password, PASSWORD_OPTS)
// apps/server/src/ticket-report.ts
export async function shiftAt(client: PoolClient, tenantId: string, at: Date): Promise<string>;
// SQL: ($2::timestamptz AT TIME ZONE (SELECT time_zone FROM tenant_info($1)))::time; same WHERE; ORDER BY starts_at DESC LIMIT 1; fallback '1'
```

## 5. Data (existing columns only)

- `machine`: the same 17 columns as today, from `cosmos-machines.json`.
- `person`: `name`, `team`, `kind`, `title`, `phone`, `default_shift`, `active` (`true`). The vendor person has a
  `null` title, phone and shift.
- `login`: `person_id`, `username`, `password_hash` (argon2id), `role`, `shared` (false),
  `must_change_password` (true), `disabled_at` (null), `cell` (null).
- `shift`: `code`, `name`, `starts_at`, `ends_at`, `crosses_midnight`, from `cosmos-shifts.json`.
- `setting.team_shifts`: jsonb `{name: shift}` from the people file. It is no longer read from the live config.
- Report `counts`: `machines` 192; `segment_CNC` 125, `segment_Robot` 1, `segment_Conventional` 16,
  `segment_Process` 17, `segment_DG` 3, `segment_Utility` 30; `people` 27; `logins` 26. The rest are unchanged.
- Report `conflicts`: the first three lines are computed by `machineConflicts`:
  - `CNC Machine Master has 126 rows: 125 CNC + 1 Robot (own segment).`
  - `In the 11 Nov registers but not the 28 Oct export: VC-57.` (and the reverse, if any)
  - `Blank make, model or serial: <segment>: <codes>` (one line per segment that has blanks)

  Then the people line becomes `26 logins (14 technician, 11 operator, 1 admin) + 1 vendor person (Imptex Team) without a login.`
  The codes, Q8 and glossary lines are kept. The VC-57 blank-nameplate, Robot-live-config and 191/192 lines are deleted.

## 6. Test cases (each fails before the change)

`packages/db/test/cosmos-seed.test.ts`, with `seedCosmos(pool, paths)` (fixture mode):

1. `loads every register machine by segment` — Given the seed, When counting machines per segment, Then
   `{CNC:125, Conventional:16, DG:3, Process:17, Robot:1, Utility:30}`. CNC+Robot equals
   `sheetCounts['CNC Machine Master']`, each other segment equals its sheet's count, and `report.counts.segment_*` match.
2. `VC-57 carries its nameplate` — Then its `make`, `model` and `serial` are non-null.
3. `seed report lists register differences` — Then `conflicts` has a line containing `VC-57` and `28 Oct`, and the
   `126 rows: 125 CNC + 1 Robot` line, and no line containing `nameplate fields left blank`.
4. `seeds 26 logins with roles, each tied to its own person` — Then roles are `{technician:14, operator:11,
admin:1}`; 26 distinct non-null `person_id`; 27 persons, 1 of them `vendor` with no login. Every login has
   `must_change_password` true, `shared` false, `disabled_at` null and a hash starting `$argon2id$`.
   Every non-vendor name matches `/^Person \d{2}$/`, every phone matches `/^\+9199999000\d{2}$/`, and there are 26 phones.
5. `team shifts and default shifts come from the people file` — Then `setting.team_shifts` equals the fixture's
   name→shift map (14 keys), and maintenance persons' `default_shift` equals their entry.
6. `shifts are the data file's windows and re-seeding is idempotent` — Then the `shift` rows are exactly
   `1 08:00:00–18:30:00 false` and `2 18:29:00–05:00:00 true`, and equal `cosmos-shifts.json`. After a second
   seed: 192 machines, 26 logins, 27 persons, 144 glossary terms.
7. `a real people file needs an initial password` — Given `peoplePath` set and no `initialPassword`, When seeding,
   Then it rejects with `SEED_INITIAL_PASSWORD`, and the existing tenant's 26 logins remain.

`apps/server/test/cosmos-plant.test.ts` (`startTestDb` + `seedCosmos(db.admin, paths)` + `buildApp` on `db.app`):

8. `a seeded login signs in` — When `POST /api/v1/auth/login` with host `cosmos.localhost`, `person01` and
   `FIXTURE_PASSWORD`, Then 200 with a token. With a wrong password, Then 401.
9. `an event at 18:29 falls in the later shift` — Then `shiftAt` returns `'1'` at `2026-11-13T18:28:00+05:30`,
   `'2'` at 18:29, `'2'` at 18:30, `'2'` at `2026-11-14T04:59:00+05:30`, and the fallback `'1'` at 05:00.

Gates: `pnpm pii:scan` passes, with the fixture and the generated JSON scanned. The full `pnpm verify` is green.

## 7. Out of scope and regression risk

Out of scope: tickets (09), staging deploy (13), person `active` or locked flags from the file, shared floor
logins, a third shift (Q8), the 18:29 ownership question N11 (changing it is a data change), `MILESTONES.md`,
`ledger.md`.

Regression risks:

- `currentShift` now uses the app clock instead of the database clock.
- The old export's 13 maintenance people are no longer seeded.
- Anything that assumed `person.team = 'maintenance'` for every staff member: operators are now `production`.
- `packages/db` tests now import `apps/server/src/auth.ts` through the seed.

## 8. Questions

1. (Caller) Accept the `generated/` and `fixtures/` paths in decision 2, or keep the decided paths and run the PR
   with `LEAN_ALLOW_LARGE`?
2. (Caller) "One fixture entry per username" is read as one entry per real user, with fake usernames, because the
   real usernames are first names (decision 3).
3. (Nimish, not blocking) The real user list has no shifts. Staging persons get no default shift unless the staging
   copy of the file adds `shift` per maintenance person. Should it?
