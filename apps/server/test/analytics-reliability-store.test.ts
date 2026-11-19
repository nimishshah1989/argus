import { DEFAULT_PROFILE } from '@uptimo/shared';
import {
  COMPUTERS,
  type CategoryFit,
  type EngineResult,
  type FigureResult,
  type MachineReliability,
  type ReliabilityValue,
} from '@uptimo/domain';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { withTenant } from '../src/kernel/index.js';
import { profileOfKey, snapshotStore } from '../src/modules/analytics/snapshot.js';
import { A, B, M_FREE, M_USED, startFixture, type Fixture } from './plant-settings-fixture.js';

let f: Fixture;
beforeAll(async () => {
  f = await startFixture();
  // The seeded plant has one closed breakdown on M_USED: one failure event, below the fit's minimum.
  const ticket = (
    await f.admin.query("SELECT id FROM ticket WHERE tenant_id = $1 AND ref = 'BD-0001'", [A])
  ).rows[0].id as string;
  await f.admin.query(
    `INSERT INTO breakdown_report (tenant_id, ticket_id, machine_id, date, shift_code, problem, downtime_min, breakdown_category)
     VALUES ($1, $2, $3, '2026-11-01', 'DAY', 'Spindle noise', 90, 'M')`,
    [A, ticket, M_USED],
  );
  // The report must be inside the run's date, and so must its ticket (the snapshot cuts tickets by reported_at).
  await f.admin.query(
    "UPDATE ticket SET reported_at = '2026-11-01T06:00:00Z' WHERE tenant_id = $1 AND ref = 'BD-0001'",
    [A],
  );
}, 180_000);
afterAll(async () => f.stop());

/** One machine's stored block: the smallest shape that is still a `MachineReliability` (a state is a result). */
const block = (ownEvents: number): MachineReliability => ({
  fit: { status: 'insufficient', ownEvents, category: null, categoryEvents: 0, minimum: 5 },
  spares: { rows: [], total: 0 },
  drill: { fit: [], spares: [] },
});

/** One fit-ready category, with numbers distinct enough to prove the right value was stored. */
const categoryFit = (index: number): CategoryFit => ({
  shape: 0.8 + index / 100,
  scale: 100 + index,
  meanHours: 110 + index,
  events: 6,
  completeIntervals: 5,
  machines: 2,
  censoredHours: 10,
  quartiles: { q25: 1, median: 2, q75: 3 },
  trend: { beta: 1, n: 6, label: 'no_clear_trend' },
});

const machinesOf = (count: number): Record<string, MachineReliability> =>
  Object.fromEntries(
    Array.from({ length: count }, (_, index) => [`machine-${index}`, block(index % 5)]),
  );

const categoriesOf = (count: number): Record<string, CategoryFit> =>
  Object.fromEntries(
    Array.from({ length: count }, (_, index) => [`Category ${index}`, categoryFit(index)]),
  );

const reliabilityValue = (
  machines: Record<string, MachineReliability>,
  categories: Record<string, CategoryFit>,
  windowStart = '2026-01-01',
  asOf = '2026-11-11',
): ReliabilityValue => ({ asOf, windowStart, minimumEvents: 5, machines, categories });

const figureOf = (
  key: string,
  value: FigureResult['value'],
  owner = 38,
  screen = 'dashboard',
): FigureResult => ({
  key,
  screen,
  owner,
  status: 'ready',
  value,
  drill: { type: 'machine', ids: [] },
});

const reliabilityFigure = (value: ReliabilityValue): FigureResult =>
  figureOf('reliability', value as unknown as FigureResult['value'], 67, 'machine-page');

/** A run as the engines hand it over: one plant figure beside ticket 67's reliability value. */
const engineResult = (asOf: string, value: ReliabilityValue): EngineResult => ({
  asOf,
  profile: DEFAULT_PROFILE,
  rows: { machines: 0, moves: 0, tickets: 0, tasks: 0, reports: 0, people: 0 },
  excludedMachines: 0,
  figures: [figureOf('dashboard.total-machines', 5), reliabilityFigure(value)],
});

/** The stored rows of a plant, read from the table itself (nothing here goes through the API). */
const snapshots = async (tenant: string) =>
  (
    await f.admin.query(
      `SELECT id, key, profile, subject_kind, subject_key, period_start::text AS period_start,
              period_end::text AS period_end, as_of::text AS as_of, run_id::text AS run_id, value
         FROM kpi_snapshot WHERE tenant_id = $1 ORDER BY key, subject_key`,
      [tenant],
    )
  ).rows as Array<Record<string, unknown>>;

describe('the reliability rows in kpi_snapshot (67 R12)', () => {
  it('stores 125 machine rows and 10 category rows beside the plant row, with no plant row for reliability', async () => {
    await withTenant(f.db.app, B, (tx) =>
      snapshotStore.save(
        tx,
        B,
        engineResult('2026-11-11', reliabilityValue(machinesOf(125), categoriesOf(10))),
      ),
    );
    const rows = await snapshots(B);
    const reliability = rows.filter((row) => row.key === 'reliability');

    // One plant row for the plant figure, 135 reliability subject rows, no plant row for reliability.
    expect(rows).toHaveLength(136);
    expect(reliability).toHaveLength(135);
    expect(reliability.filter((row) => row.subject_kind === 'machine')).toHaveLength(125);
    expect(reliability.filter((row) => row.subject_kind === 'category')).toHaveLength(10);
    expect(reliability.find((row) => row.subject_kind === 'plant')).toBeUndefined();
    expect(rows.find((row) => row.key === 'dashboard.total-machines')).toMatchObject({
      profile: 'legacy',
      subject_kind: 'plant',
      subject_key: '',
    });

    // One batch, one run id; each reliability row carries the helper's profile and the run's dates.
    expect(new Set(rows.map((row) => row.run_id)).size).toBe(1);
    expect(reliability.every((row) => row.profile === 'standard')).toBe(true);
    for (const row of reliability) {
      expect(row).toMatchObject({
        period_start: '2026-01-01',
        period_end: '2026-11-11',
        as_of: '2026-11-11',
      });
    }

    // The machine id and the trimmed category label are the subject keys, and the value is that subject's own block.
    expect(reliability.map((row) => `${row.subject_kind}:${row.subject_key}`).sort()).toEqual(
      [
        ...Array.from({ length: 10 }, (_, index) => `category:Category ${index}`),
        ...Array.from({ length: 125 }, (_, index) => `machine:machine-${index}`),
      ].sort(),
    );
    expect(
      reliability.find((row) => row.subject_kind === 'machine' && row.subject_key === 'machine-4')
        ?.value,
    ).toEqual(block(4));
    expect(
      reliability.find((row) => row.subject_kind === 'category' && row.subject_key === 'Category 7')
        ?.value,
    ).toEqual(categoryFit(7));
  });

  it('replaces the same day through the unique key and starts a new series on the next day', async () => {
    const day = '2026-11-12';
    await withTenant(f.db.app, B, (tx) =>
      snapshotStore.save(
        tx,
        B,
        engineResult(day, reliabilityValue(machinesOf(3), categoriesOf(2), '2026-01-01', day)),
      ),
    );
    const first = (await snapshots(B)).filter(
      (row) => row.key === 'reliability' && row.as_of === day,
    );
    expect(first).toHaveLength(5);
    const firstRunIds = new Set(first.map((row) => row.run_id));

    const changed = { ...machinesOf(3), 'machine-0': block(4) };
    await withTenant(f.db.app, B, (tx) =>
      snapshotStore.save(
        tx,
        B,
        engineResult(day, reliabilityValue(changed, categoriesOf(2), '2026-01-01', day)),
      ),
    );
    const replaced = (await snapshots(B)).filter(
      (row) => row.key === 'reliability' && row.as_of === day,
    );
    expect(replaced).toHaveLength(5);
    expect(replaced.find((row) => row.subject_key === 'machine-0')?.value).toEqual(block(4));
    expect(replaced.some((row) => firstRunIds.has(row.run_id))).toBe(false);

    const next = '2026-11-13';
    await withTenant(f.db.app, B, (tx) =>
      snapshotStore.save(
        tx,
        B,
        engineResult(next, reliabilityValue(machinesOf(3), categoriesOf(2), '2026-01-01', next)),
      ),
    );
    const series = (await snapshots(B)).filter(
      (row) => row.key === 'reliability' && (row.as_of === day || row.as_of === next),
    );
    expect(series).toHaveLength(10);
    expect(series.filter((row) => row.as_of === next)).toHaveLength(5);
  });

  it('drops a category label longer than the subject key the schema holds, keeping every machine row', async () => {
    const day = '2026-11-20';
    const long = 'X'.repeat(81);
    const value = reliabilityValue(
      machinesOf(2),
      { 'Turning Center': categoryFit(0), [long]: categoryFit(1) },
      '2026-01-01',
      day,
    );
    await withTenant(f.db.app, B, (tx) => snapshotStore.save(tx, B, engineResult(day, value)));
    const rows = (await snapshots(B)).filter(
      (row) => row.key === 'reliability' && row.as_of === day,
    );
    expect(rows).toHaveLength(3);
    expect(rows.filter((row) => row.subject_kind === 'machine')).toHaveLength(2);
    expect(
      rows.filter((row) => row.subject_kind === 'category').map((row) => row.subject_key),
    ).toEqual(['Turning Center']);
  });
});

describe('a run through HTTP keeps the reliability rows inside the same transaction', () => {
  it('writes the plant rows and the subject rows once, with the helper profile, and a GET never writes', async () => {
    // 48 R15's one helper: 67 adds one line beside the shift family and 50's pm-compliance, never a second mapping.
    expect(profileOfKey('shift-kpis.compare')).toBe('standard');
    expect(profileOfKey('pm-compliance')).toBe('standard');
    expect(profileOfKey('reliability')).toBe('standard');
    expect(profileOfKey('dashboard.total-machines')).toBe('legacy');

    const day = '2026-11-11';
    const tenantB = await snapshots(B);
    const run = await f.call('POST', '/api/v1/analytics/run', f.tokens.head!, { asOf: day });
    expect(run.statusCode).toBe(200);

    const figures = (
      await f.call('GET', `/api/v1/analytics/figures?asOf=${day}`, f.tokens.head!)
    ).json().figures as FigureResult[];
    const reliability = figures.find((figure) => figure.key === 'reliability')!;
    expect(reliability.status).toBe('ready');
    const value = reliability.value as unknown as ReliabilityValue;

    const after = await snapshots(A);
    const plantRows = after.filter((row) => row.key !== 'reliability');
    const subjects = after.filter((row) => row.key === 'reliability');

    // Every computed figure except reliability keeps exactly one plant row.
    expect(plantRows.map((row) => row.key).sort()).toEqual(
      Object.keys(COMPUTERS)
        .filter((key) => key !== 'reliability')
        .sort(),
    );
    expect(plantRows.every((row) => row.subject_kind === 'plant' && row.subject_key === '')).toBe(
      true,
    );

    // The reliability rows are the figure's own subjects: the two production machines, each its own block.
    const expected = [
      ...Object.keys(value.machines).map((id) => `machine:${id}`),
      ...Object.keys(value.categories).map((label) => `category:${label}`),
    ].sort();
    expect(subjects.map((row) => `${row.subject_kind}:${row.subject_key}`).sort()).toEqual(
      expected,
    );
    expect(subjects.map((row) => row.subject_key).sort()).toEqual([M_FREE, M_USED].sort());
    expect(subjects.every((row) => row.profile === 'standard')).toBe(true);
    expect(subjects.every((row) => row.period_start === '2026-01-01')).toBe(true);
    expect(subjects.every((row) => row.period_end === day && row.as_of === day)).toBe(true);

    // The seeded machine's one breakdown is one event: the row says so rather than borrowing a category.
    expect(subjects.find((row) => row.subject_key === M_USED)?.value).toMatchObject({
      fit: { status: 'insufficient', ownEvents: 1, category: null, categoryEvents: 0, minimum: 5 },
    });
    expect(subjects.some((row) => row.subject_kind === 'category')).toBe(false);
    // One batch covers both inserts.
    expect(new Set(after.map((row) => row.run_id)).size).toBe(1);

    // A GET is a read: no row is written, and another plant's rows are untouched by this run.
    const before = await snapshots(A);
    await f.call('GET', `/api/v1/analytics/figures?asOf=${day}`, f.tokens.head!);
    expect(await snapshots(A)).toEqual(before);
    expect(await snapshots(B)).toEqual(tenantB);
  });
});
