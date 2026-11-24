// @vitest-environment node
import { isValidElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { assignHandlers } from './assign.js';
import { teamFocusFixture } from './fixture.js';
import { localAction, type Acts } from './local.js';
import { ownerRows } from './writes.js';

/** Ticket 594: the edges of "I'll take it". */

const act: Acts = {
  onAssign: () => {},
  onUnassign: () => {},
  onRebalance: () => {},
  onSave: async () => {},
};

describe('owner drawer with no actions', () => {
  it('opens an owner drawer named from the ref id, with an empty list', () => {
    const id = 'owner:Nobody Holds Nothing';
    const model = { ...teamFocusFixture, actions: [] };
    const got = localAction(model, { kind: 'person', id }, act);
    expect(got).not.toBeNull();
    expect(got?.label).toBe('Nobody Holds Nothing');
    expect(isValidElement(got?.content)).toBe(true);
    expect(ownerRows(model, id)).toEqual([]);
  });
});

describe('assignHandlers', () => {
  const save = vi.fn(async () => {});
  it('are absent when the user is unknown', () => {
    const h = assignHandlers(null, '2026-11', save);
    expect(h.onAssign).toBeUndefined();
    expect(h.onUnassign).toBeUndefined();
  });
  it('are absent when the period is null', () => {
    const h = assignHandlers('Asha', null, save);
    expect(h.onAssign).toBeUndefined();
    expect(h.onUnassign).toBeUndefined();
  });
  it('are both present when both are known', () => {
    const h = assignHandlers('Asha', '2026-11', save);
    expect(typeof h.onAssign).toBe('function');
    expect(typeof h.onUnassign).toBe('function');
  });
});
