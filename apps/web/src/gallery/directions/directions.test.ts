import { describe, expect, it } from 'vitest';
import { STATUS, type StatusGroup, type StatusId } from '../../ui/status/index.js';
import { formatIN, ROLES, statusRole, TONE_ROLES } from './variant.js';

const everyStatus = (Object.keys(STATUS) as StatusGroup[]).flatMap((group) =>
  (Object.keys(STATUS[group]) as StatusId<typeof group>[]).map((id) => ({
    group,
    id,
    tone: (STATUS[group] as Record<string, { tone: string }>)[id]!.tone,
  })),
);

describe('the status to tone map', () => {
  it('gives every one of the 40 statuses a tone role', () => {
    expect(everyStatus).toHaveLength(40);
    for (const s of everyStatus) {
      expect(TONE_ROLES, `${s.group}.${s.id}`).toContain(statusRole({ group: s.group, id: s.id }));
    }
  });

  it('reads danger as critical, warning and hold as attention, ok as good, info and moved as info, muted as neutral', () => {
    const wanted: Record<string, string> = {
      danger: 'critical',
      hold: 'attention',
      warning: 'attention',
      moved: 'info',
      info: 'info',
      ok: 'good',
      muted: 'neutral',
    };
    for (const s of everyStatus) {
      if (s.group === 'ticket' && s.id === 'running') continue;
      expect(statusRole({ group: s.group, id: s.id }), `${s.group}.${s.id}`).toBe(wanted[s.tone]);
    }
  });

  it('shows Running grey, Waiting amber and Transferred blue', () => {
    expect(statusRole({ group: 'ticket', id: 'running' })).toBe('neutral');
    expect(statusRole({ group: 'ticket', id: 'waiting' })).toBe('attention');
    expect(statusRole({ group: 'ticket', id: 'transferred' })).toBe('info');
    expect(statusRole({ group: 'ticket', id: 'stopped' })).toBe('critical');
  });
});

describe('the role list', () => {
  it('names 10 neutral and accent roles and ink, tint and fill for each of the 5 tones', () => {
    expect(ROLES).toHaveLength(10 + 5 * 3);
    expect(new Set(ROLES).size).toBe(ROLES.length);
    expect(ROLES).toContain('attention-fill');
    expect(ROLES).toContain('on-accent');
  });
});

describe('Indian grouping', () => {
  it('prints 1000000 as 10,00,000 and keeps decimals', () => {
    expect(formatIN(1_000_000)).toBe('10,00,000');
    expect(formatIN(1279)).toBe('1,279');
    expect(formatIN(3060.1)).toBe('3,060.1');
    expect(formatIN(99.32)).toBe('99.32');
  });
});
