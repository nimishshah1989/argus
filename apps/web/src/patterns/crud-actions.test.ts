import { describe, expect, it } from 'vitest';
import { runBulk, switchBody } from './crud-actions.js';
import type { CrudSpec } from './crud-spec.js';

interface Row {
  id: string;
  name: string;
  active: boolean;
}

const spec = {
  switchOn: { field: 'temporaryPassword', labelKey: 'people.login.password' },
} as unknown as CrudSpec<Row>;

describe('switching a row off sends only the switch (ticket 21)', () => {
  it('never sends the reason, which the strict people schema would refuse', () => {
    const row: Row = { id: 'p1', name: 'Asha', active: true };
    expect(switchBody(spec, row, { reason: 'Left the plant' })).toEqual({ active: false });
  });

  it('sends the reason when the spec says the audit line keeps it', () => {
    const row: Row = { id: 'p1', name: 'Asha', active: true };
    const keeps = {
      switchOff: { sendReason: true },
    } as unknown as CrudSpec<Row>;
    expect(switchBody(keeps, row, { reason: 'Left the plant' })).toEqual({
      active: false,
      reason: 'Left the plant',
    });
  });

  it('sends the value a switch-on needs with the switch', () => {
    const row: Row = { id: 'l1', name: 'asha', active: false };
    expect(switchBody(spec, row, { temporaryPassword: 'a good password' })).toEqual({
      active: true,
      temporaryPassword: 'a good password',
    });
  });
});

describe('a bulk action runs every ticked row, counting refusals (ticket 21)', () => {
  it('keeps going after a refusal and reports the count and the refusal', async () => {
    const rows: Row[] = [
      { id: 'p1', name: 'Asha', active: true },
      { id: 'p2', name: 'Bina', active: true },
      { id: 'p3', name: 'Omi', active: true },
    ];
    const result = await runBulk(
      {
        id: 'off',
        labelKey: 'people.bulk.off',
        titleKey: 'people.bulk.off.title',
        run: async (row) => {
          if (row.id === 'p2') throw new Error('Bina is on tickets in progress');
        },
      },
      rows,
      { reason: 'Shift changed' },
    );
    expect(result).toMatchObject({
      done: 2,
      failed: 1,
      message: 'Bina is on tickets in progress',
    });
  });

  it('adds up the count an action reports besides its rows (devices signed out)', async () => {
    const rows: Row[] = [
      { id: 'p1', name: 'Asha', active: true },
      { id: 'p2', name: 'Bina', active: true },
    ];
    const result = await runBulk(
      {
        id: 'signOut',
        labelKey: 'people.bulk.signOut',
        titleKey: 'people.bulk.signOut.title',
        doneKey: 'people.bulk.signOut.done',
        run: async (row) => (row.id === 'p1' ? 2 : 1),
      },
      rows,
      { reason: 'Phone lost' },
    );
    expect(result).toMatchObject({
      done: 2,
      failed: 0,
      extra: 3,
      doneKey: 'people.bulk.signOut.done',
    });
  });
});
