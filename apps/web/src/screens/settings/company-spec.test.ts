import { describe, expect, it } from 'vitest';
import {
  COMPANY_FIELDS,
  companyChanges,
  companySections,
  companyValues,
  type SettingRow,
} from './company-spec.js';

const rows: SettingRow[] = [
  { key: 'company.name', value: 'Cosmos' },
  { key: 'company.language', value: 'en' },
  { key: 'company.timeZone', value: 'Asia/Kolkata' },
  { key: 'features', value: { general: true, pause: true, floorLive: false } },
];

describe('the company screen is built from its field config', () => {
  it('shows every configured field, in its section', () => {
    const [details, features] = companySections(COMPANY_FIELDS);
    expect(details!.fields.map((field) => field.id)).toContain('company.name');
    expect(details!.fields.map((field) => field.id)).toContain('company.timeZone');
    expect(features!.fields.map((field) => field.id)).toEqual([
      'features:general',
      'features:pause',
      'features:floorLive',
    ]);
  });

  it('shows a field added to the config, with no screen code', () => {
    const extra = { ...COMPANY_FIELDS[0]!, id: 'company.extra', labelKey: 'company.name' as const };
    const [details] = companySections([...COMPANY_FIELDS, extra]);
    expect(details!.fields.map((field) => field.id)).toContain('company.extra');
  });
});

describe('company values and the save', () => {
  it('reads the name, language, time zone and every feature switch', () => {
    const values = companyValues(rows);
    expect(values['company.name']).toBe('Cosmos');
    expect(values['company.language']).toBe('en');
    expect(values['company.timeZone']).toBe('Asia/Kolkata');
    expect(values['features:general']).toBe('true');
    expect(values['features:floorLive']).toBe('false');
  });

  it('saves one key per changed detail, and the whole feature record once', () => {
    const original = companyValues(rows);
    expect(companyChanges(original, { ...original })).toEqual([]);

    const renamed = companyChanges(original, { ...original, 'company.name': 'Cosmos Works' });
    expect(renamed).toEqual([{ key: 'company.name', value: 'Cosmos Works' }]);

    const live = companyChanges(original, { ...original, 'features:floorLive': 'true' });
    expect(live).toEqual([
      { key: 'features', value: { general: true, pause: true, floorLive: true } },
    ]);
  });
});
