import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { missingAttributes, missingSections } from './check-quality.js';
import { prReason } from './pr-reason.js';
import { buildBody, parseVerdicts, reasonLines, verdictFor, type PrFacts } from './pr-body.js';

const template = readFileSync(
  new URL('../.github/pull_request_template.md', import.meta.url),
  'utf8',
);
const file = (path: string, status = 'A') => ({ status, path });
const facts = (paths: string[], extra: Partial<PrFacts> = {}): PrFacts => ({
  files: paths.map((path) => file(path)),
  changed: 100,
  weakened: [],
  ...extra,
});
const input = { what: 'A new screen.', how: 'Open /gallery?view=v2-demo.' };
const SCREEN = [
  'apps/web/src/screens/v2/demo/View.tsx',
  'apps/web/src/screens/v2/demo/demo.test.ts',
  'apps/web/e2e/gallery/v2-demo.spec.ts',
  'changes/600-demo.md',
];

describe('pnpm pr:body', () => {
  it('prints a body that passes quality:pr as is, for a gallery screen', () => {
    const body = buildBody(template, facts(SCREEN), {
      ...input,
      session: 'https://example.test/s',
    });
    expect(missingAttributes(body)).toEqual([]);
    expect(missingSections(body)).toEqual([]);
    expect(body).not.toMatch(/pending/i);
    expect(prReason(body, 'No parity')).toBe(
      'v2 gallery-only screen work; no v1 behaviour changes',
    );
    expect(body).toMatch(/^Tests removed: none$/m);
    expect(body.trimEnd().split('\n').slice(-3)).toEqual([
      '🤖 Generated with [Claude Code](https://claude.com/claude-code)',
      '',
      'https://example.test/s',
    ]);
  });

  it('keeps the template comments and unfilled verdicts out of the body', () => {
    const body = buildBody(template, facts(SCREEN), input);
    expect(body).not.toMatch(/<!--|<verdict>/);
  });

  it('writes a verdict a diff cannot prove as a finding, and lets --q rule it', () => {
    const server = facts(['apps/server/src/routes.ts', 'apps/server/src/routes.test.ts']);
    expect(verdictFor('Q3', server, input)).toMatch(/^fail — /);
    expect(verdictFor('Q3', server, { ...input, verdicts: { Q3: 'pass' } })).toBe('pass');
    expect(verdictFor('Q3', facts(SCREEN), input)).toMatch(/^n\/a — /);
  });

  it('fails Q1 for code with no test, and passes docs as n/a', () => {
    expect(verdictFor('Q1', facts(['apps/web/src/a.ts']), input)).toMatch(/^fail — /);
    expect(verdictFor('Q1', facts(['docs/x.md']), input)).toMatch(/^n\/a — /);
    expect(verdictFor('Q1', facts(SCREEN), input)).toBe('pass');
  });

  it('fails Q2 on a weakened test unless the builder gives the reason', () => {
    const weak = facts(SCREEN, { weakened: ['a.test.ts: removed test'] });
    expect(verdictFor('Q2', weak, input)).toMatch(/^fail — a\.test\.ts/);
    expect(verdictFor('Q2', weak, { ...input, testsRemoved: 'replaced by a better one' })).toMatch(
      /^pass/,
    );
    expect(reasonLines(weak, input).lines).not.toContain('Tests removed: none');
  });

  it('fails Q12 without exactly one changelog fragment', () => {
    expect(verdictFor('Q12', facts(['apps/web/src/a.ts']), input)).toMatch(/^fail — /);
    expect(verdictFor('Q12', facts(SCREEN), input)).toBe('pass');
  });

  it('asks for a Large PR reason over 800 lines, and writes it when given', () => {
    const big = facts(SCREEN, { changed: 801 });
    expect(() => buildBody(template, big, input)).toThrow(/--large/);
    expect(
      prReason(buildBody(template, big, { ...input, large: 'one generated fixture' }), 'Large PR'),
    ).toBe('one generated fixture');
  });

  it('asks for a No parity reason outside the v2 gallery, and writes it when given', () => {
    const outside = facts(['apps/web/src/main.tsx', 'changes/600-x.md']);
    expect(() => buildBody(template, outside, input)).toThrow(/--no-parity/);
    const body = buildBody(template, outside, {
      ...input,
      noParity: 'tooling and style sheets only',
    });
    expect(prReason(body, 'No parity')).toBe('tooling and style sheets only');
  });

  it('needs the what and the how', () => {
    expect(() => buildBody(template, facts(SCREEN), { what: '', how: '' })).toThrow(
      /--what[\s\S]*--try/,
    );
  });

  it('ticks the verification boxes for the commands that were run', () => {
    const body = buildBody(template, facts(SCREEN), {
      ...input,
      ran: 'pnpm precheck, pnpm verify',
    });
    expect(body).toMatch(/- \[x\] `pnpm precheck`/);
    expect(body).toMatch(/- \[ \] `pnpm test:e2e`/);
    expect(body).toMatch(/^Ran: pnpm precheck, pnpm verify$/m);
  });

  it('reads --q pairs and refuses a malformed one', () => {
    expect(parseVerdicts(['Q3=pass', 'Q11=n/a — no runtime change'])).toEqual({
      Q3: 'pass',
      Q11: 'n/a — no runtime change',
    });
    expect(() => parseVerdicts(['Q3'])).toThrow(/Q<n>=<verdict>/);
  });
});
