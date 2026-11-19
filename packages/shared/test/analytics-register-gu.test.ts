import { describe, expect, it } from 'vitest';
import { en, gu } from '../src/i18n/index.js';

/**
 * The words the Breakdown Log, the registers and the machine page print (ticket 87) all have Gujarati: none of
 * them falls back to English. A key added to one of these families later fails here until it is translated.
 */
const FAMILIES = [
  'analytics.log.',
  'analytics.breakdowns.nav',
  'analytics.table.',
  'analytics.register.',
  'analytics.registers.',
  'analytics.machines.nav',
  'analytics.machine.',
  'analytics.cellLog.',
  'analytics.figure.shift-kpis.',
  'analytics.figure.reliability',
  'pm.tasks.',
  'analytics.screen.breakdown-log',
  'analytics.screen.registers',
  'analytics.screen.machine-page',
];

/** A controlled-document number: a code the plant reads as it is printed, never translated. */
const CODES = new Set(['analytics.cellLog.docNo']);
/** A word that is only an acronym (CNC, DG, MTTR, KVA) is the same in both languages, by the glossary. */
const ACRONYM = /^[A-Z][A-Z0-9 ]*$/;

describe('the register screens in Gujarati', () => {
  const keys = Object.keys(en).filter(
    (key) => FAMILIES.some((family) => key.startsWith(family)) && !CODES.has(key),
  );

  it('covers a real set of keys', () => {
    expect(keys.length).toBeGreaterThan(110);
  });

  it.each(keys)('translates %s', (key) => {
    const value = (gu as Record<string, string>)[key] ?? '';
    expect(value.trim().length).toBeGreaterThan(0);
    const english = (en as Record<string, string>)[key] ?? '';
    if (!ACRONYM.test(english)) expect(value).not.toBe(english);
  });
});
