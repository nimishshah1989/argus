// @vitest-environment node
import { readFileSync } from 'node:fs';
import { en, gu } from '@uptimo/shared/i18n';
import { COMPUTERS, FIGURES } from '@uptimo/domain';
import { Navigate } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { groupFor } from '../../analytics/groups.js';
import { GUIDE_ENTRIES } from '../../analytics/guide-entries.js';
import { liveScreen } from '../live.js';

describe('S18 OEM is live in the Machines group (ADR 0051)', () => {
  it('the engine computes oem-analytics from every year the plant recorded', () => {
    const figure = FIGURES.find((f) => f.key === 'oem-analytics');
    expect(figure).toMatchObject({ screen: 'oem-analytics', reads: 'history' });
    expect(typeof COMPUTERS['oem-analytics']).toBe('function');
  });

  it('sits in the Machines group right after Age, with a label in English and Gujarati', () => {
    const screens = groupFor('machines')!.screens;
    expect(screens[screens.indexOf('a8-age') + 1]).toBe('oem-analytics');
    const words = [en, gu] as Record<string, string>[];
    for (const key of ['analytics.screen.oem-analytics', 'analytics.figure.oem-analytics'])
      for (const catalogue of words) expect(catalogue[key], key).toBeTruthy();
  });

  it('draws the v2 screen at /analytics/machines?screen=oem-analytics', () => {
    const drawn = liveScreen('machines', 'oem-analytics');
    expect(drawn).not.toBeNull();
    expect(drawn?.type).not.toBe(Navigate);
    expect(drawn?.key).toBe('machines:oem-analytics');
  });

  it('waits for the engine like Age does, and reads no money', () => {
    const register = readFileSync(new URL('./register.ts', import.meta.url), 'utf8');
    expect(register).toMatch(/requireComputed\(reply, 'oem-analytics'\)/);
    expect(register).not.toMatch(/mayReadMoney/);
  });

  it('the Guide explains OEM as built, pointing at its figure', () => {
    const oem = GUIDE_ENTRIES.find((e) => e.id === 'oem')!;
    expect(oem.built).toBe(true);
    expect(oem.figures).toEqual(['oem-analytics']);
    expect(oem.bodyKeys).not.toContain('analytics.guide.notBuilt');
    expect(oem.bodyKeys.length).toBeGreaterThan(0);
  });
});
