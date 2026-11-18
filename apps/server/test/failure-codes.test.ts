import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { withTenant } from '@uptimo/db';
import { failureCodeIndex, resolveFailureCode } from '@uptimo/shared';
import {
  DEFAULT_FAILURE_CODES,
  FAILURE_CODE_ALIASES,
  failureCodeSeedRows,
} from '../src/modules/plant/failure-code-defaults.js';
import { ensureFailureCodes, failureCodeIndexOf } from '../src/modules/plant/index.js';
import { startFixture, type Fixture, type Res } from './plant-settings-fixture.js';

const LISTS = '/api/v1/settings/lists';
const A = '10000000-0000-0000-0000-000000000001';
const B = '20000000-0000-0000-0000-000000000001';
/** A plant made for the seed walks below: no logins, no tickets, just the codes it holds. */
const C = '70000000-0000-4000-8000-0000000000c1';

type Code = { code: string; description: string };
/** The live plant's own 19 codes, in the order the answer key holds them (the fallback's order). */
const liveCodes = (
  JSON.parse(
    readFileSync(
      fileURLToPath(new URL('../../../fixtures/answer-key/input.json', import.meta.url)),
      'utf8',
    ),
  ) as { settings: { codes: Code[] } }
).settings.codes;
const bare = (code: string, active = true) => ({ code, label: code, sort: 0, active });
/** Cosmos's maintenance list: the 19 live codes as bare labels plus the three old alternates, switched off. */
const cosmosCodes = [
  ...liveCodes.map(({ code }) => bare(code)),
  ...['ELE', 'HYD', 'ROT'].map((code) => bare(code, false)),
];

describe('resolving an old failure code through the list', () => {
  const index = failureCodeIndex([
    { code: 'E', aliases: ['ele', 'ELECTRICAL'] },
    { code: 'HY', aliases: ['hyd'] },
  ]);

  it('resolves a code or an alias in any letter case, trimmed', () => {
    expect(resolveFailureCode(index, 'E')).toBe('E');
    expect(resolveFailureCode(index, ' ele ')).toBe('E');
    expect(resolveFailureCode(index, 'Electrical')).toBe('E');
    expect(resolveFailureCode(index, 'HYD')).toBe('HY');
    expect(resolveFailureCode(index, 'hy')).toBe('HY');
  });

  it('answers null for a code it does not hold, so the caller keeps the raw value', () => {
    expect(resolveFailureCode(index, 'MEC')).toBeNull();
    expect(resolveFailureCode(index, '')).toBeNull();
    expect(resolveFailureCode(index, '   ')).toBeNull();
  });
});

describe('the plant module’s own fallback codes', () => {
  it('is the answer key’s 19 codes: its order, its descriptions, the three aliases', () => {
    expect(DEFAULT_FAILURE_CODES).toHaveLength(19);
    expect(DEFAULT_FAILURE_CODES.map((row) => row.code)).toEqual(liveCodes.map((c) => c.code));
    expect(DEFAULT_FAILURE_CODES.map((row) => row.label)).toEqual(
      liveCodes.map((c) => c.description),
    );
    expect(DEFAULT_FAILURE_CODES.map((row) => row.sort)).toEqual(
      liveCodes.map((_, position) => position + 1),
    );
    expect(DEFAULT_FAILURE_CODES.every((row) => row.active)).toBe(true);
    expect(FAILURE_CODE_ALIASES).toEqual({ ele: 'E', hyd: 'HY', rot: 'RT' });
    expect(DEFAULT_FAILURE_CODES.find((row) => row.code === 'E')!.aliases).toEqual(['ele']);
    expect(DEFAULT_FAILURE_CODES.find((row) => row.code === 'HY')!.aliases).toEqual(['hyd']);
    expect(DEFAULT_FAILURE_CODES.find((row) => row.code === 'RT')!.aliases).toEqual(['rot']);
    expect(DEFAULT_FAILURE_CODES.find((row) => row.code === 'M')!.aliases).toEqual([]);
  });
});

describe('seeding the list from a plant’s own maintenance codes', () => {
  it('copies the plant’s codes, describes a bare-code label from the fallback, and folds the alternates', () => {
    const rows = failureCodeSeedRows(cosmosCodes);
    expect(rows).toHaveLength(19);
    expect(rows.map((row) => row.code)).toEqual(liveCodes.map((c) => c.code));
    expect(rows.map((row) => row.label)).toEqual(liveCodes.map((c) => c.description));
    expect(rows.find((row) => row.code === 'ELE')).toBeUndefined();
    expect(rows.find((row) => row.code === 'HYD')).toBeUndefined();
    expect(rows.find((row) => row.code === 'ROT')).toBeUndefined();
    expect(rows.find((row) => row.code === 'E')!.aliases).toEqual(['ele']);
    expect(rows.find((row) => row.code === 'HY')!.aliases).toEqual(['hyd']);
    expect(rows.find((row) => row.code === 'RT')!.aliases).toEqual(['rot']);
  });

  it('keeps a code the plant owns, with the plant’s label, and invents nothing', () => {
    expect(
      failureCodeSeedRows([{ code: 'GRS', label: 'Gearbox repair', sort: 4, active: true }]),
    ).toEqual([{ code: 'GRS', label: 'Gearbox repair', sort: 4, active: true, aliases: [] }]);
  });

  it('keeps a legacy code whose target the plant does not have as a row of its own', () => {
    expect(failureCodeSeedRows([bare('ELE', false)])).toEqual([
      { code: 'ELE', label: 'ELE', sort: 0, active: false, aliases: [] },
    ]);
  });

  it('uses the fallback 19 only when the plant has no maintenance codes at all', () => {
    expect(failureCodeSeedRows([])).toEqual(DEFAULT_FAILURE_CODES);
  });

  it('never seeds a code that another row claims as an alias, in any letter case', () => {
    const rows = failureCodeSeedRows(cosmosCodes);
    const codes = rows.map((row) => row.code.trim().toLowerCase());
    const aliases = rows.flatMap((row) => row.aliases);
    expect(new Set(codes).size).toBe(codes.length);
    expect(new Set(aliases).size).toBe(aliases.length);
    expect(aliases.filter((alias) => codes.includes(alias))).toEqual([]);
  });
});

let f: Fixture;

beforeAll(async () => {
  f = await startFixture();
  await f.admin.query("INSERT INTO tenant (id, slug, name) VALUES ($1, 'seed-c', 'Seed C')", [C]);
}, 180_000);
afterAll(async () => f.stop());

const seedAudits = async (tenantId: string) =>
  (
    await f.admin.query(
      "SELECT id, before, after FROM audit_log WHERE tenant_id = $1 AND action = 'failure_code.seed'",
      [tenantId],
    )
  ).rows as Array<{ id: string; before: unknown; after: unknown }>;

const failureList = (token: string): Promise<Res> => f.call('GET', `${LISTS}/failure_code`, token);
const itemsOf = (res: Res) => res.json().items as Array<Record<string, unknown>>;
const itemOf = (items: Array<Record<string, unknown>>, code: string) =>
  items.find((item) => item.code === code)!;

describe('the first read of the list seeds it once, from the plant', () => {
  it('writes nothing on the config read', async () => {
    const config = await f.call('GET', '/api/v1/config', f.tokens.head!);
    expect(config.statusCode, config.body).toBe(200);
    expect(config.json().lists.failure_code ?? []).toEqual([]);
    expect(await seedAudits(A)).toEqual([]);
  });

  it('seeds the fallback 19 from two reads at once, and a second read adds nothing', async () => {
    const [one, two] = await Promise.all([
      failureList(f.tokens.head!),
      failureList(f.tokens.admin!),
    ]);
    expect(one.statusCode, one.body).toBe(200);
    expect(two.statusCode, two.body).toBe(200);
    const items = itemsOf(one);
    expect(items).toHaveLength(19);
    expect(itemOf(items, 'E')).toMatchObject({
      label: 'Electronics/Electrical',
      aliases: ['ele'],
      active: true,
    });
    expect(itemOf(items, 'HY').aliases).toEqual(['hyd']);
    expect(itemOf(items, 'RT').aliases).toEqual(['rot']);
    expect(itemsOf(two)).toEqual(items);

    expect(itemsOf(await failureList(f.tokens.head!))).toEqual(items);
    const audits = await seedAudits(A);
    expect(audits).toHaveLength(1);
    expect(audits[0]!.after).toEqual({ codes: 19 });
  });

  it('does not copy a maintenance code added after the seed', async () => {
    const made = await f.call('POST', `${LISTS}/maint_code`, f.tokens.head!, {
      code: 'LATE',
      label: 'Added later',
    });
    expect(made.statusCode, made.body).toBe(201);
    const items = itemsOf(await failureList(f.tokens.head!));
    expect(items).toHaveLength(19);
    expect(itemOf(items, 'LATE')).toBeUndefined();
  });
});

describe('a plant that holds its own codes', () => {
  it('seeds the code the plant added through the settings API, not the fallback 19', async () => {
    const made = await f.call('POST', `${LISTS}/maint_code`, f.tokens['b-admin']!, {
      code: 'GRS',
      label: 'Gearbox repair',
      sort: 4,
    });
    expect(made.statusCode, made.body).toBe(201);
    expect(itemsOf(await failureList(f.tokens['b-admin']!))).toEqual([
      expect.objectContaining({
        code: 'GRS',
        label: 'Gearbox repair',
        sort: 4,
        active: true,
        aliases: [],
      }),
    ]);
  });

  it('keeps ELE as its own row when the plant has no E to fold it into', async () => {
    await f.admin.query(
      "INSERT INTO list_item (tenant_id, list, code, label, active) VALUES ($1, 'maint_code', 'ELE', 'Electrical (alt)', false)",
      [C],
    );
    await withTenant(f.db.app, C, (tx) => ensureFailureCodes(tx, { tenantId: C, loginId: null }));
    const rows = (
      await f.admin.query(
        "SELECT code, label, active, aliases FROM list_item WHERE tenant_id = $1 AND list = 'failure_code'",
        [C],
      )
    ).rows;
    expect(rows).toEqual([{ code: 'ELE', label: 'Electrical (alt)', active: false, aliases: [] }]);
    expect(await seedAudits(C)).toHaveLength(1);
  });
});

describe('editing the list through the generated settings routes', () => {
  it('normalises old codes to a lower-case array and switches a code off, each edit audited once', async () => {
    const items = itemsOf(await failureList(f.tokens.head!));
    const e = itemOf(items, 'E');
    const m = itemOf(items, 'M');

    const edited = await f.call('PUT', `${LISTS}/failure_code/${e.id}`, f.tokens.head!, {
      aliases: 'ele, ELECTRICAL',
    });
    expect(edited.statusCode, edited.body).toBe(200);
    expect(edited.json().aliases).toEqual(['ele', 'electrical']);

    const off = await f.call('PUT', `${LISTS}/failure_code/${m.id}`, f.tokens.head!, {
      active: false,
    });
    expect(off.statusCode, off.body).toBe(200);
    expect(off.json().active).toBe(false);

    const lines = (
      await f.admin.query(
        "SELECT before, after FROM audit_log WHERE tenant_id = $1 AND action = 'list_item.update' AND entity_id = ANY($2::uuid[]) ORDER BY at",
        [A, [e.id, m.id]],
      )
    ).rows as Array<{ before: Record<string, unknown>; after: Record<string, unknown> }>;
    expect(lines).toHaveLength(2);
    expect(lines[0]!.before).toMatchObject({ aliases: ['ele'] });
    expect(lines[0]!.after).toMatchObject({ aliases: ['ele', 'electrical'] });
    expect(lines[1]!.before).toMatchObject({ active: true });
    expect(lines[1]!.after).toMatchObject({ active: false });
  });

  it('refuses an alias or a code another row already claims, in any letter case', async () => {
    const m = itemOf(itemsOf(await failureList(f.tokens.head!)), 'M');
    const alias = await f.call('PUT', `${LISTS}/failure_code/${m.id}`, f.tokens.head!, {
      aliases: 'ELECTRICAL',
    });
    expect(alias.statusCode, alias.body).toBe(409);

    const code = await f.call('POST', `${LISTS}/failure_code`, f.tokens.head!, {
      code: 'ELE',
      label: 'Electrical again',
    });
    expect(code.statusCode, code.body).toBe(409);
  });

  it('still resolves a switched-off code, so an old report keeps its code', async () => {
    const index = await withTenant(f.db.app, A, (tx) => failureCodeIndexOf(tx, A));
    expect(resolveFailureCode(index, 'm')).toBe('M');
    expect(resolveFailureCode(index, 'ele')).toBe('E');
  });
});

describe('the list is the plant’s own', () => {
  it('never shows or resolves another plant’s alias', async () => {
    const grs = itemOf(itemsOf(await failureList(f.tokens['b-admin']!)), 'GRS');
    const made = await f.call('PUT', `${LISTS}/failure_code/${grs.id}`, f.tokens['b-admin']!, {
      aliases: 'b-secret',
    });
    expect(made.statusCode, made.body).toBe(200);
    expect(made.json().aliases).toEqual(['b-secret']);

    const a = itemsOf(await failureList(f.tokens.head!));
    expect(a.flatMap((item) => item.aliases)).not.toContain('b-secret');
    const aIndex = await withTenant(f.db.app, A, (tx) => failureCodeIndexOf(tx, A));
    expect(resolveFailureCode(aIndex, 'B-SECRET')).toBeNull();
    const bIndex = await withTenant(f.db.app, B, (tx) => failureCodeIndexOf(tx, B));
    expect(resolveFailureCode(bIndex, 'b-secret')).toBe('GRS');
  });

  it('checks for the list before it reaches for the seed lock', async () => {
    const queries: string[] = [];
    const tx = {
      query: async (sql: string) => {
        queries.push(sql);
        if (/advisory/i.test(sql)) throw new Error('took the seed lock with rows already there');
        return { rows: [{ present: true }], rowCount: 1 } as never;
      },
    } as unknown as PoolClient;
    await expect(ensureFailureCodes(tx, { tenantId: A, loginId: null })).resolves.toBeUndefined();
    expect(queries).toHaveLength(1);
  });
});
