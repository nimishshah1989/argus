import { describe, expect, it } from 'vitest';
import type { Lockout } from '@uptimo/shared/lockout';
import { ApiError } from '../api.js';
import { isGated, localisedLabel, lockoutRefusalKey, lockoutView } from './lockout.js';

const STEPS: Lockout['steps'] = [
  { code: 'isolate', label: 'Switch off', labelGu: 'બંધ કરો', labelHi: null },
  { code: 'lock_tag', label: 'Lock and tag', labelGu: null, labelHi: null },
];
const ME = 'person-me';
const lockout = (by: string[] = []): Lockout => ({
  steps: STEPS,
  confirmations: by.map((byPersonId) => ({ at: '2026-11-14T10:15:00.000Z', byPersonId })),
});
const base = { personId: ME, onCrew: false, offered: ['start', 'cancel'] as string[] };

describe('what the ticket shows about lockout', () => {
  it('shows nothing on a ticket that needs no lockout', () => {
    expect(lockoutView({ ...base, lockout: null, status: 'open' })).toBeNull();
  });

  it('asks for the ticks before Start', () => {
    const view = lockoutView({ ...base, lockout: lockout(), status: 'open' });
    expect(view).toMatchObject({ kind: 'ticking' });
  });

  it('asks again when only somebody else confirmed', () => {
    const view = lockoutView({ ...base, lockout: lockout(['someone-else']), status: 'open' });
    expect(view?.kind).toBe('ticking');
  });

  it('shows my own confirmation as done, whoever else confirmed', () => {
    const view = lockoutView({ ...base, lockout: lockout([ME]), status: 'open' });
    expect(view).toMatchObject({ kind: 'confirmed', byPersonId: ME });
  });

  it('asks for the ticks before Resume and before Add me as support', () => {
    const resume = { ...base, offered: ['resume'], lockout: lockout() };
    expect(lockoutView({ ...resume, status: 'waiting' })?.kind).toBe('ticking');
    const join = { ...base, offered: ['join'], lockout: lockout(['someone-else']) };
    expect(lockoutView({ ...join, status: 'working' })?.kind).toBe('ticking');
  });

  it('only records "confirm before touching the machine" for crew on a working ticket with none standing', () => {
    const view = lockoutView({
      ...base,
      onCrew: true,
      offered: ['pause'],
      lockout: lockout(),
      status: 'working',
    });
    expect(view?.kind).toBe('record');
    expect(isGated(view, 'pause')).toBe(false);
  });

  it('shows nothing to a viewer who cannot start, resume or join and has no part in the work', () => {
    expect(
      lockoutView({ ...base, offered: ['cancel'], lockout: lockout(), status: 'working' }),
    ).toBeNull();
  });

  it('fails closed when the plant has no steps', () => {
    const none: Lockout = { steps: [], confirmations: [] };
    expect(lockoutView({ ...base, lockout: none, status: 'open' })?.kind).toBe('missing');
  });
});

describe('which buttons wait for the ticks', () => {
  const ticking = lockoutView({ ...base, lockout: lockout(), status: 'open' });
  it('holds Start, Resume and Join, and nothing else', () => {
    for (const action of ['start', 'resume', 'join']) expect(isGated(ticking, action)).toBe(true);
    for (const action of ['cancel', 'pause', 'update', 'close']) {
      expect(isGated(ticking, action)).toBe(false);
    }
  });
  it('holds nothing once I have confirmed', () => {
    const done = lockoutView({ ...base, lockout: lockout([ME]), status: 'open' });
    expect(isGated(done, 'start')).toBe(false);
  });
});

describe('what the person is told when the server refuses', () => {
  const refuse = (code: string) => new ApiError(code, 'server words', undefined, 409);
  it('names each lockout refusal in the floor words', () => {
    expect(lockoutRefusalKey(refuse('lockout_required'))).toBe('lockout.refused');
    expect(lockoutRefusalKey(refuse('steps_changed'))).toBe('lockout.stepsChanged');
    expect(lockoutRefusalKey(refuse('lockout_steps_missing'))).toBe('lockout.noSteps');
  });
  it('leaves every other failure to the ordinary message', () => {
    expect(lockoutRefusalKey(refuse('conflict'))).toBeNull();
    expect(lockoutRefusalKey(new Error('offline'))).toBeNull();
  });
});

describe('step wording', () => {
  it('uses the Gujarati label when there is one, else English', () => {
    expect(localisedLabel(STEPS[0]!, 'gu')).toBe('બંધ કરો');
    expect(localisedLabel(STEPS[1]!, 'gu')).toBe('Lock and tag');
    expect(localisedLabel(STEPS[0]!, 'en')).toBe('Switch off');
  });
});
