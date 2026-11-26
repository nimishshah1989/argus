import { describe, expect, it } from 'vitest';
import {
  ASSET_KINDS,
  assetRegisterReplySchema,
  type AssetRegisterReply,
} from '@uptimo/shared/plant-settings';
import type { CrudCtx } from '../../../patterns/crud-spec.js';
import { registersSpec, watchOf } from './registers-spec.js';

/**
 * D05: a settings screen is config against the shared reply schema, and a test fails when a schema key is neither a
 * form field nor listed as hidden/read-only with a reason. `id` and `active` are the row's identity and switch.
 */
const STRUCTURAL = new Set(['id', 'active']);

const t = ((key: string, options?: Record<string, unknown>) =>
  options ? `${key} ${JSON.stringify(options)}` : key) as unknown as CrudCtx['t'];
const ctx = { lookups: {}, t } as CrudCtx;

const reply = (over: Partial<AssetRegisterReply> = {}): AssetRegisterReply => ({
  id: '00000000-0000-0000-0000-000000000001',
  kind: 'amc',
  machineId: '00000000-0000-0000-0000-000000000002',
  vendor: null,
  reference: null,
  startsOn: '2026-01-01',
  endsOn: '2026-12-31',
  dueOn: null,
  leadDays: 15,
  ownerPersonId: null,
  notes: 'AMC',
  active: true,
  ...over,
});

describe('the registers settings spec accounts for its reply keys (D05)', () => {
  it('every reply key is a field, hidden or read-only with a reason', () => {
    const fields = new Set<string>(registersSpec.fields.map((field) => field.name));
    const hidden = registersSpec.hidden ?? {};
    const readOnly = registersSpec.readOnly ?? {};
    const keys = Object.keys(assetRegisterReplySchema.shape);
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      if (STRUCTURAL.has(key)) continue;
      expect(
        fields.has(key) || key in hidden || key in readOnly,
        `registers.${key} is neither field, hidden nor read-only`,
      ).toBe(true);
      if (key in hidden) expect(hidden[key]!.trim(), `registers.${key} has no reason`).not.toBe('');
      if (key in readOnly)
        expect(readOnly[key]!.trim(), `registers.${key} has no reason`).not.toBe('');
    }
  });

  it('asks the ten fields, with the three dates as date inputs and kind a required choice', () => {
    expect(registersSpec.fields.map((field) => field.name)).toEqual([
      'kind',
      'machineId',
      'vendor',
      'reference',
      'startsOn',
      'endsOn',
      'dueOn',
      'leadDays',
      'ownerPersonId',
      'notes',
    ]);
    const field = (name: string) => registersSpec.fields.find((item) => item.name === name)!;
    expect(field('kind').required).toBe(true);
    expect(field('kind').kind).toBe('choice');
    expect(field('kind').choices!(ctx).map((choice) => choice.value)).toEqual([...ASSET_KINDS]);
    for (const name of ['startsOn', 'endsOn', 'dueOn']) expect(field(name).kind).toBe('date');
    expect(field('machineId').kind).toBe('choice');
    expect(field('ownerPersonId').kind).toBe('choice');
  });

  it('offers the four kind chips and a search, and asks the switch’s reason', () => {
    expect(registersSpec.filter!.options(ctx).map((option) => option.code)).toEqual([
      ...ASSET_KINDS,
    ]);
    expect(registersSpec.filter?.allKey).toBe('plant.registers.allKinds');
    expect(registersSpec.search?.labelKey).toBe('plant.registers.search');
    expect(registersSpec.switchOff).toEqual({
      hintKey: 'plant.registers.removeHint',
      sendReason: true,
    });
  });

  it('watches due_on else ends_on, and never starts_on (R8)', () => {
    expect(watchOf(reply({ dueOn: '2026-12-01', endsOn: '2026-11-01' }))).toBe('2026-12-01');
    expect(watchOf(reply({ dueOn: null, endsOn: '2026-11-01' }))).toBe('2026-11-01');
    expect(watchOf(reply({ dueOn: null, endsOn: null }))).toBeNull();
  });

  it('states the reminder, the missing date and the missing owner in the form note', () => {
    const withDate = registersSpec.note!(
      {
        kind: 'amc',
        dueOn: '2026-12-01',
        leadDays: '15',
        ownerPersonId: '00000000-0000-0000-0000-000000000009',
      },
      null,
      ctx,
    )!;
    expect(withDate).toContain('plant.registers.remindBefore');
    expect(withDate).toContain('"days":15');
    expect(withDate).toContain('2026-12-01');
    expect(withDate).toContain('plant.registers.notesHint');

    const withoutDate = registersSpec.note!(
      { kind: 'legal', ownerPersonId: '00000000-0000-0000-0000-000000000009' },
      null,
      ctx,
    )!;
    expect(withoutDate).toContain('plant.registers.noWatchNote');

    const withoutOwner = registersSpec.note!({ kind: 'amc', endsOn: '2026-12-31' }, null, ctx)!;
    expect(withoutOwner).toContain('plant.registers.noOwnerNote');
  });
});
