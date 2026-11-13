import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { looksLikeBhavinExport, parseBhavinExport } from '../src/modules/imports/bhavin-export.js';
import { checkTicketFigures, type FigureCheck } from '../src/modules/imports/real-oracle.js';

const FILE = new URL('./fixtures/bhavin-export.pseudonymised.json', import.meta.url);
const raw = JSON.parse(readFileSync(FILE, 'utf8')) as unknown;
const exported = parseBhavinExport(raw);
const checks = exported.tickets.flatMap(checkTicketFigures);
const count = (verdict: FigureCheck['verdict']) => checks.filter((c) => c.verdict === verdict);

describe('reading Bhavin export as he writes it', () => {
  it('recognises his shape and not the synthetic contract', () => {
    expect(looksLikeBhavinExport(raw)).toBe(true);
    expect(looksLikeBhavinExport({ source: 'argus.synthetic-bhavin/v1', tickets: [] })).toBe(false);
    expect(looksLikeBhavinExport({ tickets: [{ id: 'x' }] })).toBe(false);
    expect(looksLikeBhavinExport({ source: 'bhavin-v3', tickets: [] })).toBe(false);
    expect(exported.tickets).toHaveLength(275);
  });
});

describe('every figure equals his stored number, or something named explains it', () => {
  it('leaves no unexplained difference', () => {
    expect(count('unexplained')).toEqual([]);
    expect(checks.length).toBeGreaterThan(2000);
  });

  it('names the edit behind every edit-explained figure', () => {
    const edited = count('edit');
    expect(edited.length).toBeGreaterThan(0);
    for (const check of edited)
      expect(check.detail).toMatch(/^\d{4}-\d\d-\d\dT.+ (started|closed|reported|work|waiting)/);
  });

  it('explains the older support tickets and the half-minute cases by name', () => {
    expect(count('rule').every((c) => c.figure === 'downtimeMin')).toBe(true);
    expect(count('rule').length).toBe(23);
    expect(
      count('timing')
        .map((c) => c.ref)
        .sort(),
    ).toEqual(['BD-0116', 'BD-0144']);
  });

  it('reports a wrong stored number that nothing explains', () => {
    const planted = structuredClone(
      exported.tickets.find((t) => t.status === 'closed' && t.kind === 'stopped'),
    )!;
    planted.repairMin = (planted.repairMin ?? 0) + 7;
    const bad = checkTicketFigures(planted).filter((c) => c.verdict === 'unexplained');
    expect(bad.map((c) => c.figure)).toEqual(['repairMin']);
  });
});
