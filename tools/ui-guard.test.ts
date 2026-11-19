import { describe, expect, it } from 'vitest';
import { FAIL_ON_FINDINGS, guardFindings, guardSummary } from './ui-guard.js';

const file = (path: string, text: string) => ({ path, text });
const where = (path: string, text: string) =>
  guardFindings([file(path, text)]).map((f) => `${f.line}:${f.kind}`);

describe('ui guard (ticket 82)', () => {
  it('counts raw colours and hand-written cards in screens/ and components/ only', () => {
    const findings = guardFindings([
      file('screens/Desk.tsx', 'const a = "#dc2626";\nconst b = `rgb(1, 2, 3)`;'),
      file('components/X.tsx', '<div className="rounded-2xl bg-surface p-4 text-red-600">'),
      file('ui/card.tsx', '<section className="rounded-2xl bg-surface">'),
      file('faces/a.tsx', 'const c = "#fff";'),
    ]);
    expect(findings.map((f) => `${f.path}:${f.line}:${f.kind}`)).toEqual([
      'screens/Desk.tsx:1:raw colour',
      'screens/Desk.tsx:2:raw colour',
      'components/X.tsx:1:raw colour',
      'components/X.tsx:1:hand-written card',
    ]);
  });

  it('flags named colours in class strings and CSS-in-JS', () => {
    expect(where('screens/A.tsx', 'const s = { color: "red" };')).toEqual(['1:raw colour']);
    expect(where('screens/A.tsx', '<p className="bg-white text-gray-600">')).toEqual([
      '1:raw colour',
    ]);
  });

  it('leaves tokens, entities, comments and tests alone', () => {
    expect(
      where('screens/B.tsx', '<p className="bg-good-tint text-neutral-700 rounded-lg">'),
    ).toEqual([]);
    expect(where('screens/B.tsx', 'a &#123; b, href="#main"')).toEqual([]);
    expect(
      where('components/C.tsx', '// the old #ff0000\n/** rgb(0,0,0) */\n * red: #fff'),
    ).toEqual([]);
    expect(where('components/C.test.tsx', 'const x = "#fff";')).toEqual([]);
  });

  it('summarises per file with totals, and only warns until ticket 87', () => {
    const lines = guardSummary(
      guardFindings([file('screens/A.tsx', 'x = "#fff";\n<i className="rounded-xl bg-surface">')]),
    );
    expect(lines).toEqual([
      '  screens/A.tsx: 1 raw colour(s), 1 card(s)',
      'ui guard: 1 raw colour(s), 1 hand-written card(s) in 1 file(s)',
    ]);
    expect(FAIL_ON_FINDINGS).toBe(false);
  });
});
