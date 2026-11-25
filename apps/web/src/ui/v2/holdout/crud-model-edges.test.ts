// @vitest-environment node
import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';
import type { CrudCtx, CrudSpec } from '../../../patterns/crud-spec.js';
import { missingRequired, sheetFields, submitHeld, switchFields } from '../crud-model.js';

type Row = { id: string; active: boolean };
const t = ((key: string) => key) as unknown as TFunction;
const ctx: CrudCtx = { lookups: {}, t };

describe('v2 CRUD kit: edges', () => {
  it('offline wins over pending, missing and blocked; blocked holds when all else is fine', () => {
    expect(submitHeld({ pending: true, online: false, missing: true, blocked: true })).toBe(
      'offline',
    );
    expect(submitHeld({ pending: false, online: true, missing: false, blocked: true })).toBe(
      'blocked',
    );
    expect(submitHeld({ pending: false, online: true, missing: false, blocked: false })).toBeNull();
  });

  it('a field that is not required never holds, even empty', () => {
    expect(missingRequired([{ name: 'n', label: 'N' }], { n: '' })).toBe(false);
    expect(missingRequired([], {})).toBe(false);
  });

  it('keeps a field required on edit when it is required (not just requiredOnAdd)', () => {
    const spec = {
      resource: 'r',
      titleKey: 'x',
      emptyKey: 'x',
      fields: [{ name: 'name', labelKey: 'n', required: true, requiredOnAdd: true }],
    } as unknown as CrudSpec<Row>;
    expect(sheetFields(spec, { id: '1', active: true }, ctx)[0]!.required).toBe(true);
  });

  it('switching an on row off with only switchOn configured is sent at once', () => {
    const spec = {
      resource: 'r',
      titleKey: 'x',
      emptyKey: 'x',
      fields: [],
      switchOn: { field: 'password', labelKey: 'p' },
    } as unknown as CrudSpec<Row>;
    expect(switchFields(spec, { id: '1', active: true }, t)).toBeNull();
  });
});
