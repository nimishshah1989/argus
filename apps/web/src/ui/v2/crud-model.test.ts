// @vitest-environment node
import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';
import type { CrudCtx, CrudSpec } from '../../patterns/crud-spec.js';
import { missingRequired, sheetFields, submitHeld, switchFields } from './crud-model.js';

type Row = { id: string; active: boolean; code: string; name: string };
const t = ((key: string) => `T:${key}`) as unknown as TFunction;
const ctx: CrudCtx = { lookups: { kinds: ['a', 'b'] }, t };
const spec = {
  resource: 'things',
  titleKey: 'kit.crud.save',
  emptyKey: 'kit.crud.save',
  fields: [
    { name: 'code', labelKey: 'f.code', required: true, addOnly: true },
    { name: 'name', labelKey: 'f.name' },
    { name: 'password', labelKey: 'f.pw', requiredOnAdd: true },
    {
      name: 'kind',
      labelKey: 'f.kind',
      kind: 'choice',
      choices: (c: CrudCtx) => (c.lookups.kinds as string[]).map((v) => ({ value: v, label: v })),
    },
  ],
} as unknown as CrudSpec<Row>;
const row: Row = { id: '1', active: true, code: 'M1', name: 'Lathe' };

describe('v2 CRUD kit: the sheet fields', () => {
  it('asks every field when adding, with requiredOnAdd counted as required', () => {
    const fields = sheetFields(spec, null, ctx);
    expect(fields.map((f) => [f.name, f.label, !!f.required])).toEqual([
      ['code', 'T:f.code', true],
      ['name', 'T:f.name', false],
      ['password', 'T:f.pw', true],
      ['kind', 'T:f.kind', false],
    ]);
    expect(fields[3]!.kind).toBe('choice');
    expect(fields[3]!.choices).toEqual([
      { value: 'a', label: 'a' },
      { value: 'b', label: 'b' },
    ]);
  });

  it('leaves addOnly fields out when editing, and requiredOnAdd is not required there', () => {
    const fields = sheetFields(spec, row, ctx);
    expect(fields.map((f) => f.name)).toEqual(['name', 'password', 'kind']);
    expect(fields.find((f) => f.name === 'password')!.required).toBeFalsy();
  });
});

describe('v2 CRUD kit: switching a row', () => {
  it('asks a required reason before switching off when the spec says so', () => {
    const off = { ...spec, switchOff: {} } as CrudSpec<Row>;
    expect(switchFields(off, row, t)).toEqual([
      { name: 'reason', label: 'T:kit.crud.reason', required: true, multiline: true },
    ]);
  });

  it('sends the switch at once when the spec asks nothing', () => {
    expect(switchFields(spec, row, t)).toBeNull();
    expect(switchFields(spec, { ...row, active: false }, t)).toBeNull();
  });

  it('asks the switchOn field before switching an off row on', () => {
    const on = {
      ...spec,
      switchOn: { field: 'password', labelKey: 'f.newpw' },
    } as unknown as CrudSpec<Row>;
    expect(switchFields(on, { ...row, active: false }, t)).toEqual([
      { name: 'password', label: 'T:f.newpw', required: true },
    ]);
  });
});

describe('v2 CRUD kit: what holds the submit', () => {
  const fields = [
    { name: 'code', label: 'Code', required: true },
    { name: 'note', label: 'Note' },
  ];

  it('checks required fields only, after trimming', () => {
    expect(missingRequired(fields, { code: '  ' })).toBe(true);
    expect(missingRequired(fields, {})).toBe(true);
    expect(missingRequired(fields, { code: 'M1' })).toBe(false);
  });

  it('holds offline, while pending, and with a field missing', () => {
    expect(submitHeld({ pending: false, online: false, missing: false })).toBe('offline');
    expect(submitHeld({ pending: true, online: true, missing: false })).toBe('pending');
    expect(submitHeld({ pending: false, online: true, missing: true })).toBe('missing');
    expect(submitHeld({ pending: false, online: true, missing: false })).toBeNull();
  });
});
