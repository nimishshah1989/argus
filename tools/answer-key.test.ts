import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { scanText } from './check-pii.js';
import { answerKeyErrors, keptScreens } from './parity.js';
import { loadDenyList } from './pii-sources.js';
import { namesIn } from './answer-key/generate.js';
import { readWorkbook, type Cell } from './answer-key/xlsx.js';

const KEY = 'fixtures/answer-key';
const WORKBOOK = 'docs/discovery/real-2026-11-13/cosmos-export-2026-11-11.xlsx';
const triage = readFileSync('docs/plan/m4a-triage.md', 'utf8');
const sheets = readWorkbook(WORKBOOK);

interface Table {
  title: string;
  header: string[];
  rows: string[][];
}
interface Screen {
  pages: { kpis: { label: string; value: string }[]; tables: Table[] }[];
}
const read = <T>(name: string): T => JSON.parse(readFileSync(`${KEY}/${name}.json`, 'utf8')) as T;
const screen = (name: string): Screen['pages'][number] => read<Screen>(name).pages[0] as never;

const num = (text: string): number => Number(text.replace(/[,%]| hrs/g, ''));
const data = (name: string): Cell[][] => {
  const rows = sheets[name] as Cell[][];
  const at = rows.findIndex((r) => r[0] === 'Category' || r[0] === 'Cell' || r[0] === 'Name');
  return rows.slice(at + 1).filter((r) => r.length > 1 && r[0] !== '');
};

describe('the answer key', () => {
  it('has a fixture for every file a kept screen names, and each declares that screen', () => {
    expect(keptScreens(triage).length).toBeGreaterThan(25);
    expect(answerKeyErrors(triage)).toEqual([]);
  });

  it('fails when a row names another screen’s fixture', () => {
    const swapKeys = (text: string, a: string, b: string): string =>
      text
        .split('\n')
        .map((line) => {
          const cells = line.split('|');
          const id = cells[1]?.trim();
          if (cells.length > 6 && (id === a || id === b)) cells[5] = id === a ? ` ${b} ` : ` ${a} `;
          return cells.join('|');
        })
        .join('\n');
    expect(answerKeyErrors(swapKeys(triage, 'a1-bd-pm', 'a2-category-cell'))).toContain(
      'a1-bd-pm: answer key a2-category-cell.json answers a2-category-cell, not a1-bd-pm',
    );
  });

  it('holds the same rows as the workbook it was computed from', () => {
    const input = read<Record<string, unknown[]>>('input');
    const filled = (name: string): number => {
      const rows = sheets[name] as Cell[][];
      const header = rows.findIndex((r) => r[0] === 'Sr.' || r[0] === 'Date');
      return rows.slice(header + 1).filter((r) => r[1] != null && r[1] !== '').length;
    };
    expect(input.breakdowns!.length + input.otherBD!.length).toBe(filled('Breakdown Log'));
    expect(input.machines!.length).toBe(filled('CNC Machine Master'));
    expect(input.cellChangeLog!.length).toBe(filled('Cell Change Log'));
    expect(input.pmPlan!.length).toBe(filled('PM Plan'));
  });

  it('gives the totals of A1 that the workbook’s own Analytics 1 sheet gives', () => {
    const sheet = Object.fromEntries(
      (sheets['Analytics 1 - BD%'] as Cell[][])
        .filter((r) => r.length === 2)
        .map((r) => [r[0], r[1]]),
    );
    const kpi = (label: string): number =>
      num(screen('a1-bd-pm').kpis.find((k) => k.label === label)?.value ?? 'NaN');
    expect(kpi('Total Machines')).toBe(sheet['Total Machines']);
    expect(kpi('Total Available Hrs')).toBeCloseTo(sheet['Total Available Hrs'] as number, 2);
    expect(kpi('Actual Breakdown')).toBeCloseTo(sheet['Actual Breakdown Hours'] as number, 1);
    expect(kpi('PM Downtime')).toBeCloseTo(sheet['PM Hours'] as number, 1);
  });

  it('gives each cell of A1 and each category of A2 and A3 as the workbook does', () => {
    const cells = data('Analytics 1 - BD%').slice(0, 9);
    screen('a1-bd-pm').tables[0]!.rows.forEach((row, i) => {
      expect(num(row[1]!)).toBe(cells[i]![1]);
      expect(num(row[2]!)).toBeCloseTo(cells[i]![2] as number, 2);
      expect(num(row[3]!)).toBeCloseTo(cells[i]![3] as number, 2);
    });
    const a2 = data('Analytics 2 - Category-Cell').slice(0, 14);
    screen('a2-category-cell').tables[0]!.rows.forEach((row, i) => {
      expect([row[0], num(row[1]!), num(row[2]!)]).toEqual([
        String(a2[i]![0]).replace(/\s+/g, ' '),
        a2[i]![1],
        a2[i]![2],
      ]);
      expect(num(row[3]!)).toBeCloseTo(a2[i]![3] as number, 2);
    });
    const a3 = data('Analytics 3 - MTTR-MTBF').slice(0, 14);
    screen('a3-mttr-mtbf').tables[0]!.rows.forEach((row, i) => {
      expect(Math.abs(num(row[4]!) - (a3[i]![4] as number))).toBeLessThanOrEqual(0.0051);
      expect(Math.abs(num(row[5]!) - (a3[i]![5] as number))).toBeLessThanOrEqual(0.0051);
    });
  });

  it('gives the manpower figures of A4 as the workbook does, whatever the order', () => {
    const wanted = data('Analytics 4 - Manpower').map(
      (r) => `${r[2]}|${(r[3] as number).toFixed(2)}`,
    );
    const shown = screen('a4-manpower')
      .tables[0]!.rows.filter((r) => r[1] === 'Team' || r[1] === 'Vendor')
      .map((r) => `${r[2]}|${r[3]}`);
    expect(shown.sort()).toEqual(wanted.sort());
  });

  it('holds no real name or phone from the source lists, not even a principal or an English-word name', () => {
    const deny = loadDenyList();
    const hits = readdirSync(KEY)
      .filter((file) => file.endsWith('.json'))
      .flatMap((file) => scanText(file, readFileSync(`${KEY}/${file}`, 'utf8'), deny));
    expect(hits).toEqual([]);
  });

  it('keeps a model number that looks like a phone number, and codes a real phone', () => {
    const registers = readFileSync(`${KEY}/registers.json`, 'utf8');
    expect(registers.includes('+9199999')).toBe(false);
  });
});

describe('the names the generator codes', () => {
  const people = {
    breakdowns: [{ observedBy: 'Fake Person', doneBy: 'Operator, Other Fake' }],
    otherBD: [],
    pmReports: [{ reviewedBy: 'Third Fake' }],
    settings: {
      team: [{ name: 'Fourth Fake' }],
      gwLog: [{ doneBy: 'Fifth Fake', reportedBy: 'Sixth Fake' }],
      acAcks: { 'freq|VC-1': { owner: 'Seventh Fake' } },
    },
  };

  it('takes every people field wherever it sits, observed-by included, and skips roles', () => {
    const names = namesIn(people as never);
    for (const name of [
      'fake person',
      'other fake',
      'third fake',
      'fourth fake',
      'fifth fake',
      'sixth fake',
      'seventh fake',
    ])
      expect(names).toContain(name);
    expect(names).not.toContain('operator');
  });
});
