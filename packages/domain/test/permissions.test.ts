import { describe, expect, it } from 'vitest';
import {
  canCancel,
  canClose,
  canCorrect,
  canRaise,
  canRestore,
  canSettingsAi,
  canSettingsLists,
  canSettingsPeople,
  canWork,
} from '../src/permissions.js';
import type { ActorContext, TicketContext } from '../src/types.js';

function actor(role: ActorContext['role'], over: Partial<ActorContext> = {}): ActorContext {
  return { role, loginId: 'login-1', personId: 'person-1', shared: false, ...over };
}

const openTicket: TicketContext = {
  raisedLoginId: 'login-1',
  leadPersonId: null,
  startedAt: null,
  status: 'open',
  crew: [],
};

describe('permissions', () => {
  it('lets every role except board raise', () => {
    expect(canRaise(actor('operator'))).toBe(true);
    expect(canRaise(actor('admin'))).toBe(true);
    expect(canRaise(actor('board'))).toBe(false);
  });

  it('lets an operator cancel only their own un-started ticket', () => {
    expect(canCancel(actor('operator'), openTicket)).toBe(true);
    expect(canCancel(actor('operator', { loginId: 'other' }), openTicket)).toBe(false);
    expect(canCancel(actor('operator'), { ...openTicket, startedAt: new Date() })).toBe(false);
  });

  it('gates work actions to technician and above', () => {
    expect(canWork(actor('technician'))).toBe(true);
    expect(canWork(actor('supervisor'))).toBe(true);
    expect(canWork(actor('head'))).toBe(true);
    expect(canWork(actor('admin'))).toBe(true);
    expect(canWork(actor('operator'))).toBe(false);
    expect(canWork(actor('plant_head'))).toBe(false);
    expect(canWork(actor('board'))).toBe(false);
  });

  it('lets a technician close only as lead, primary or on a shared login', () => {
    expect(canClose(actor('technician'), openTicket)).toBe(false);
    expect(canClose(actor('technician'), { ...openTicket, leadPersonId: 'person-1' })).toBe(true);
    expect(canClose(actor('technician', { shared: true }), openTicket)).toBe(true);
    expect(canClose(actor('supervisor'), openTicket)).toBe(true);
  });

  it('reserves restore and correct to admin', () => {
    expect(canRestore(actor('admin'))).toBe(true);
    expect(canRestore(actor('head'))).toBe(false);
    expect(canCorrect(actor('admin'))).toBe(true);
    expect(canCorrect(actor('technician'))).toBe(false);
  });

  it('scopes settings to head/admin and people to admin only', () => {
    expect(canSettingsLists(actor('head'))).toBe(true);
    expect(canSettingsLists(actor('technician'))).toBe(false);
    expect(canSettingsPeople(actor('admin'))).toBe(true);
    expect(canSettingsPeople(actor('head'))).toBe(false);
  });

  it('keeps the AI consent and spending settings with the admin alone', () => {
    expect(canSettingsAi(actor('admin'))).toBe(true);
    for (const role of [
      'head',
      'plant_head',
      'supervisor',
      'technician',
      'operator',
      'board',
    ] as const) {
      expect(canSettingsAi(actor(role)), role).toBe(false);
    }
  });
});
