import { describe, expect, it } from 'vitest';
import {
  missingTranslations,
  savedOverrides,
  searchTranslations,
  storedOverrides,
} from './translations-spec.js';

describe('the translation screen’s setting', () => {
  it('reads the plant’s overrides from GET /settings, or an empty map when it never set one', () => {
    expect(storedOverrides([])).toEqual({});
    expect(
      storedOverrides([
        { key: 'features', value: { general: true } },
        { key: 'i18n.overrides', value: { 'plant.menu.machines': 'મશીન' } },
      ]),
    ).toEqual({ 'plant.menu.machines': 'મશીન' });
  });

  it('ignores a malformed setting instead of spreading nonsense into the UI', () => {
    expect(storedOverrides([{ key: 'i18n.overrides', value: ['x'] }])).toEqual({});
    expect(storedOverrides([{ key: 'i18n.overrides', value: { a: 3, b: 'સાચવો' } }])).toEqual({
      b: 'સાચવો',
    });
  });

  it('lists the keys still missing Gujarati, and takes an override off the list', () => {
    const before = missingTranslations({});
    expect(before.length).toBeGreaterThan(0);
    const key = before[0]!.key;
    const after = missingTranslations({ [key]: 'ગુજરાતી' });
    expect(after.map((row) => row.key)).not.toContain(key);
    expect(after.length).toBe(before.length - 1);
    expect(before[0]!.en).toBeTruthy();
  });

  it('saves the typed text trimmed and keeps the overrides already stored', () => {
    expect(savedOverrides({ 'a.b': 'સાચવો' }, { 'a.c': '  રદ કરો  ', 'a.d': '   ' })).toEqual({
      'a.b': 'સાચવો',
      'a.c': 'રદ કરો',
    });
  });

  it('searches by key or English, ignoring case, and shows every row for no search', () => {
    const rows = [
      { key: 'plant.menu.machines', en: 'Machines' },
      { key: 'company.title', en: 'Company' },
    ];
    expect(searchTranslations(rows, '')).toEqual(rows);
    expect(searchTranslations(rows, 'MACHIN')).toEqual([rows[0]]);
    expect(searchTranslations(rows, 'company.title')).toEqual([rows[1]]);
    expect(searchTranslations(rows, 'zzz')).toEqual([]);
  });
});
