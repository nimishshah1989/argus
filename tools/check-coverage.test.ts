import { describe, expect, it } from 'vitest';
import { changedScreens, coverageProblems, scopePath } from './check-coverage.js';

const HEAD = '| Item | Source | v2 | Where in v2 |\n| --- | --- | --- | --- |';
const table = (...rows: string[]): string => [HEAD, ...rows].join('\n');
const CLEAN = table('| Open count | ActionCenterPage.tsx:40 | same | header tile |');
const YES = 'Nimish said yes: 2026-11-21';

const bodyWith = (coverage: string | null): string =>
  `## What changed and why\n\nA screen.\n\n${coverage === null ? '' : `## Coverage\n\n${coverage}\n\n`}## How to try it\n\nOpen it.\n`;

const SCREEN_FILES = ['apps/web/src/screens/v2/team-focus/View.tsx'];
const SCOPE = scopePath('team-focus');

function problems(body: string, scopeText: string | null, changed = [...SCREEN_FILES, SCOPE]) {
  return coverageProblems({
    body,
    changed,
    read: (path) =>
      path === SCOPE ? scopeText : path.endsWith('/team-focus/View.tsx') ? '' : null,
  });
}

describe('which PRs the coverage gate applies to', () => {
  it('Q16 names each v2 screen folder with a changed non-test tsx file', () => {
    expect(
      changedScreens([
        'apps/web/src/screens/v2/team-focus/View.tsx',
        'apps/web/src/screens/v2/team-focus/local.tsx',
        'apps/web/src/screens/v2/compare/sub/Row.tsx',
      ]),
    ).toEqual(['compare', 'team-focus']);
  });

  it('Q16 ignores tests, fixtures, shared v2 files and every other screen', () => {
    expect(
      changedScreens([
        'apps/web/src/screens/v2/team-focus/team-focus.test.tsx',
        'apps/web/src/screens/v2/team-focus/model.ts',
        'apps/web/src/screens/v2/nav.ts',
        'apps/web/src/screens/analytics/ActionCenterPage.tsx',
        'docs/design/v2/scope/batch1.md',
      ]),
    ).toEqual([]);
  });

  it('Q16 passes a PR with no v2 screen change even with no table and a MISSING audit', () => {
    const audit = ['docs/design/v2/scope/batch1.md', 'tools/check-coverage.ts'];
    expect(
      coverageProblems({
        body: bodyWith(null),
        changed: audit,
        read: () => table('| a | b | MISSING | c |'),
      }),
    ).toEqual([]);
  });
});

describe('rule 1: a ## Coverage table in the body', () => {
  it('Q16 fails a screen PR whose body has no Coverage section', () => {
    expect(problems(bodyWith(null), CLEAN)).toEqual([expect.stringContaining('## Coverage')]);
  });

  it('Q16 fails a Coverage section with a header and no data row', () => {
    expect(problems(bodyWith(HEAD), CLEAN)).toEqual([
      expect.stringContaining('at least one data row'),
    ]);
  });

  it('Q16 fails a Coverage section that holds no table with a v2 column', () => {
    const noV2 = '| Item | Source |\n| --- | --- |\n| a | b |';
    expect(problems(bodyWith(noV2), CLEAN)).toHaveLength(1);
  });

  it('Q16 ignores a table that sits in a template comment', () => {
    const body = `## What changed and why\n\n<!-- ## Coverage\n\n${CLEAN} -->\n`;
    expect(problems(body, CLEAN)).toEqual([expect.stringContaining('## Coverage')]);
  });

  it('Q16 passes a body with a Coverage table and one data row', () => {
    expect(problems(bodyWith(CLEAN), CLEAN)).toEqual([]);
  });

  it('Q16 does not let a table under a later heading count as the Coverage table', () => {
    const body = `## Coverage\n\nnone yet\n\n## Notes\n\n${CLEAN}\n`;
    expect(problems(body, CLEAN)).toHaveLength(1);
  });
});

describe('rule 2: the same table committed under docs/design/v2/scope', () => {
  it('Q16 fails when the scope file is not in the diff, even if it exists on main', () => {
    const result = problems(bodyWith(CLEAN), CLEAN, SCREEN_FILES);
    expect(result).toEqual([expect.stringContaining(SCOPE)]);
  });

  it('Q16 fails when the scope file in the diff has no data row', () => {
    expect(problems(bodyWith(CLEAN), HEAD)).toEqual([expect.stringContaining(SCOPE)]);
  });

  it('Q16 asks for one scope file per changed screen folder', () => {
    const changed = [...SCREEN_FILES, 'apps/web/src/screens/v2/compare/View.tsx', SCOPE];
    const result = problems(bodyWith(CLEAN), CLEAN, changed);
    expect(result).toEqual([expect.stringContaining(scopePath('compare'))]);
  });

  it('Q16 passes when the scope file is in the diff with a clean table', () => {
    expect(problems(bodyWith(CLEAN), CLEAN)).toEqual([]);
  });
});

describe('rule 3: MISSING or DROPPED needs Nimish said yes', () => {
  const missing = table('| Priority filter | ActionCenterPage.tsx:90 | MISSING | none |');
  const dropped = table('| Export | ActionCenterPage.tsx:12 | DROPPED | none |');

  it('Q16 fails a MISSING row in the body and names the item', () => {
    expect(problems(bodyWith(missing), CLEAN)).toEqual([
      expect.stringContaining('Priority filter'),
    ]);
  });

  it('Q16 fails a DROPPED row in the scope file', () => {
    expect(problems(bodyWith(CLEAN), dropped)).toEqual([expect.stringContaining('Export')]);
  });

  it('Q16 fails a sign-off with no date', () => {
    const row = table('| Export | f:1 | DROPPED | Nimish said yes: |');
    expect(problems(bodyWith(row), CLEAN)).toHaveLength(1);
  });

  it('Q16 fails a sign-off that is not at the end of the row', () => {
    const row = table(`| Export | f:1 | DROPPED | ${YES} but also see the drawer |`);
    expect(problems(bodyWith(row), CLEAN)).toHaveLength(1);
  });

  it('Q16 passes a MISSING row whose last cell ends with the sign-off', () => {
    const row = table(`| Export | f:1 | MISSING | ${YES} |`);
    expect(problems(bodyWith(row), row)).toEqual([]);
  });

  it('Q16 passes a DROPPED row whose v2 cell ends with the sign-off, in either date style', () => {
    const iso = table(`| Export | f:1 | DROPPED. ${YES} | |`);
    const long = table('| Export | f:1 | DROPPED, Nimish said yes: 20 Nov 2026 | |');
    expect(problems(bodyWith(iso), long)).toEqual([]);
  });

  it('Q16 reads only the v2 column: a source cell that says MISSING is not a finding', () => {
    const row = table('| Missing-data banner | MISSING-state spec | same | banner |');
    expect(problems(bodyWith(row), row)).toEqual([]);
  });

  it('Q16 checks every table in the section, not only the first', () => {
    const second = `### More intelligent\n\n| Insight | Source | v2 |\n| --- | --- | --- |\n| Rank | engine | MISSING |`;
    expect(problems(bodyWith(`${CLEAN}\n\n${second}`), CLEAN)).toEqual([
      expect.stringContaining('Rank'),
    ]);
  });
});

describe('shared v2 folders are not screens', () => {
  it('Q16 does not hold a PR that only changes shared code with no View.tsx (printed-page, entity)', () => {
    expect(
      coverageProblems({
        body: bodyWith(null),
        changed: [
          'apps/web/src/screens/v2/printed-page/PageBody.tsx',
          'apps/web/src/screens/v2/entity/EntityShell.tsx',
        ],
        read: () => null,
      }),
    ).toEqual([]);
  });

  it('Q16 still holds a real screen changed next to shared code', () => {
    const changed = ['apps/web/src/screens/v2/printed-page/PageBody.tsx', ...SCREEN_FILES];
    expect(problems(bodyWith(null), null, changed)).not.toEqual([]);
  });
});
