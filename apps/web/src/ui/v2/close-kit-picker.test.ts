import { describe, expect, it } from 'vitest';
import { pickerGroups } from './close-kit.js';

const OPTIONS = [
  { value: 'M', label: 'Mechanical' },
  { value: 'E', label: 'Electrical' },
  { value: 'H', label: 'Hydraulic' },
  { value: 'P', label: 'Pneumatic' },
];
const values = (list: { value: string }[]) => list.map((o) => o.value);

describe('pickerGroups', () => {
  it('puts the recent codes first, newest first, and each code once', () => {
    const groups = pickerGroups(OPTIONS, ['H', 'M'], '', '');
    expect(values(groups.recent)).toEqual(['H', 'M']);
    expect(values(groups.rest)).toEqual(['E', 'P']);
  });

  it('drops a recent code the list no longer offers (switched off)', () => {
    expect(values(pickerGroups(OPTIONS, ['X', 'E'], '', '').recent)).toEqual(['E']);
  });

  it('narrows both groups to the search text, in the label or the code, any case', () => {
    const groups = pickerGroups(OPTIONS, ['H', 'M'], 'ic', '');
    expect(values(groups.recent)).toEqual(['H', 'M']);
    expect(values(groups.rest)).toEqual(['E', 'P']);
    expect(values(pickerGroups(OPTIONS, [], 'hyd', '').rest)).toEqual(['H']);
    expect(values(pickerGroups(OPTIONS, [], 'e', '').rest)).toEqual(['M', 'E', 'P']);
  });

  it('keeps the chosen code whatever the search says', () => {
    expect(values(pickerGroups(OPTIONS, [], 'pneu', 'M').rest)).toEqual(['M', 'P']);
  });
});
