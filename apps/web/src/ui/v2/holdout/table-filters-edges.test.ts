import { describe, expect, it } from 'vitest';
import { applyFilters, optionsOf, type TableSelect } from '../table-filters.js';

type Stop = { id: string; age: string; shift: string };
const STOPS: Stop[] = [
  { id: 's1', age: 'Unknown', shift: 'A' },
  { id: 's2', age: '20+', shift: '' },
  { id: 's3', age: '10-15', shift: 'B' },
  { id: 's4', age: '5-10', shift: 'A' },
  { id: 's5', age: '0-5', shift: '' },
  { id: 's6', age: '15-20', shift: 'B' },
  { id: 's7', age: '5-10', shift: 'B' },
];
const age: TableSelect<Stop> = { key: 'age', label: 'Age', value: (r) => r.age };
const shift: TableSelect<Stop> = { key: 'shift', label: 'Shift', value: (r) => r.shift };
const ids = (rows: Stop[]) => rows.map((r) => r.id);
const all = ids(STOPS);

describe('table filters: edges (ticket 688)', () => {
  it('an empty choice keeps every row', () => {
    expect(ids(applyFilters(STOPS, [age, shift], {}))).toEqual(all);
    expect(ids(applyFilters(STOPS, [age, shift], { age: '', shift: '' }))).toEqual(all);
    expect(ids(applyFilters(STOPS, [age, shift], { age: '', shift: 'A' }))).toEqual(['s1', 's4']);
  });

  it('a chosen key no select has is ignored', () => {
    expect(ids(applyFilters(STOPS, [age], { machine: 'M-01' }))).toEqual(all);
    expect(ids(applyFilters(STOPS, [age], { machine: 'M-01', age: '5-10' }))).toEqual(['s4', 's7']);
  });

  it('sorts age bands with numbers in numeric order', () => {
    expect(optionsOf(STOPS, age)).toEqual(['0-5', '5-10', '10-15', '15-20', '20+', 'Unknown']);
  });

  it('drops blank values from the options', () => {
    expect(optionsOf(STOPS, shift)).toEqual(['A', 'B']);
    expect(optionsOf([], shift)).toEqual([]);
  });
});
