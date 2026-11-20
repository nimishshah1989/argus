// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { en, gu } from '@uptimo/shared/i18n';
import { engineTable } from './table.js';
import { catOf, dayText, mayReadMoney, numberIn, withoutMoney } from './read.js';

const sources = (dir: string): string[] =>
  readdirSync(new URL(dir, import.meta.url), { recursive: true, encoding: 'utf8' })
    .filter((name) => /\.tsx?$/.test(name) && !/\.test\./.test(name))
    .map((name) => readFileSync(new URL(`${dir}/${name}`, import.meta.url), 'utf8'));

describe('the words of the Machines screens', () => {
  const code = [...sources('..'), ...sources('../../../gallery')].join('\n');
  const keys = [
    ...new Set(
      [...code.matchAll(/['"]((?:v2m|analytics)\.[A-Za-z0-9.-]+)['"]/g)].map((m) => m[1]!),
    ),
  ];

  it('has every catalogue key a screen asks for, in English', () => {
    const missing = keys.filter((key) => !Object.hasOwn(en, key));
    expect(missing).toEqual([]);
  });

  it('has each of its own keys in Gujarati too, so a translation can fill them', () => {
    const own = Object.keys(en).filter((key) => key.startsWith('v2m.'));
    expect(own.length).toBeGreaterThan(40);
    expect(own.filter((key) => !Object.hasOwn(gu, key))).toEqual([]);
  });
});

describe('reading the engine’s printed figures', () => {
  it('reads the number a printed figure holds, whatever the grouping', () => {
    expect(numberIn('1,136.5 hrs')).toBe(1136.5);
    expect(numberIn('₹ 1,07,000 lost')).toBe(107000);
    expect(numberIn('none yet')).toBeNull();
  });

  it('writes a plant day as DD-MMM-YYYY and leaves anything else alone', () => {
    expect(dayText('2026-11-11')).toBe('11-Nov-2026');
    expect(dayText('11 Nov')).toBe('11 Nov');
  });

  it('keeps a machine type’s colour the same wherever it appears', () => {
    expect(catOf('Turning Center')).toBe(catOf('turning center'));
    expect(catOf('Vertical Machining Center')).toBeGreaterThanOrEqual(1);
    expect(catOf('Vertical Machining Center')).toBeLessThanOrEqual(5);
  });

  it('takes the rupee clauses out of a line and says nothing when only rupees were there', () => {
    expect(withoutMoney('56% of the hours; ₹ 59,994 to claim')).toBe('56% of the hours');
    expect(withoutMoney('₹ 1.07 lakh of lost output')).toBeNull();
  });

  it('shows money to a head, a plant head and an admin, and to nobody else', () => {
    expect(['head', 'plant_head', 'admin'].map(mayReadMoney)).toEqual([true, true, true]);
    expect(['op', 'lead', undefined].map((role) => mayReadMoney(role))).toEqual([
      false,
      false,
      false,
    ]);
  });
});

describe('a table of printed cells', () => {
  const table = {
    title: 'Machines',
    header: ['#', 'Machine ID', 'Hours', ''],
    rows: [
      ['1', 'VC-1', '1,200.5', 'Edit'],
      ['2', 'VC-2', '—', 'Edit'],
      ['3', 'VC-3', '40', 'Edit'],
    ],
  };
  const words = { title: 'Machines', search: '', showing: '', noResults: '', open: '', all: '' };
  const model = engineTable(table, { id: 't', title: 'Machines', words });

  it('drops the engine’s row number and its action columns and keeps every figure', () => {
    expect(model.header.map((h) => h.label)).toEqual(['Machine ID', 'Hours']);
    expect(model.rows.map((row) => row.map((cell) => cell.text))).toEqual([
      ['VC-1', '1,200.5'],
      ['VC-2', '—'],
      ['VC-3', '40'],
    ]);
  });

  it('sorts a column of numbers as numbers, with a dash last when sorted high to low', () => {
    expect(model.header[1]?.numeric).toBe(true);
    const order = model.rows
      .map((row) => row[1]!)
      .sort((a, b) => Number(b.sort) - Number(a.sort))
      .map((cell) => cell.text);
    expect(order).toEqual(['1,200.5', '40', '—']);
  });
});
