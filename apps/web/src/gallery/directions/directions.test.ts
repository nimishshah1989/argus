import { describe, expect, it } from 'vitest';
import { STATUS, type StatusGroup, type StatusId } from '../../ui/status/index.js';
import {
  formatIN,
  paletteProblems,
  ROLES,
  statusRole,
  TONE_ROLES,
  type Palette,
} from './variant.js';

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
    const tones = ['critical', 'attention', 'good', 'info', 'neutral'];
    expect([...ROLES].sort()).toEqual(
      [
        ...[
          'page',
          'surface',
          'surface-2',
          'line',
          'control',
          'ink',
          'ink-2',
          'accent',
          'on-accent',
          'accent-tint',
        ],
        ...tones.flatMap((t) => [`${t}-ink`, `${t}-tint`, `${t}-fill`]),
      ].sort(),
    );
  });
});

describe('a palette', () => {
  const full = {
    ...Object.fromEntries(ROLES.map((r, i) => [r, `#${(i + 16).toString(16)}0000`])),
    series: [
      '#101010',
      '#202020',
      '#303030',
      '#404040',
      '#505050',
      '#606060',
      '#707070',
      '#808080',
    ],
    seq: ['#111111', '#222222', '#333333', '#444444', '#555555'],
    div: ['#121212', '#232323', '#343434', '#454545', '#565656'],
  } as unknown as Palette;
  const problems = (p: object) => paletteProblems(p as Palette);

  it('has no problem when every role, 8 series and two 5-step ramps are set', () => {
    expect(problems(full)).toEqual([]);
  });

  it('names a missing role, a short series and a short ramp', () => {
    const broken = {
      ...full,
      'good-fill': '',
      series: full.series.slice(0, 7),
      seq: full.seq.slice(0, 4),
    };
    expect(problems(broken)).toEqual([
      'good-fill is not a hex colour',
      'series has 7 colours, not 8',
      'seq has 4 steps, not 5',
    ]);
  });

  it('names a series that equals a status colour, whatever its letter case', () => {
    const clash = {
      ...full,
      series: [full['critical-fill'].toUpperCase(), ...full.series.slice(1)],
    };
    expect(problems(clash)).toEqual(['series 1 equals critical-fill']);
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
