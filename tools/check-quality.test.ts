import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  missingAttributes,
  missingSections,
  pushRefusal,
  REVIEW,
  weakenedTests,
} from './check-quality.js';

const DELETE_ASSERTION = `diff --git a/apps/x.test.ts b/apps/x.test.ts
index 1111111..2222222 100644
--- a/apps/x.test.ts
+++ b/apps/x.test.ts
@@ -1,3 +1,2 @@
 it('adds', () => {
-  expect(add(1, 2)).toBe(3);
 });
`;

// Built with an interpolation so this repo's own Q2 scan does not flag its own fixture.
const ADD_SKIP = `diff --git a/apps/x.test.ts b/apps/x.test.ts
--- a/apps/x.test.ts
+++ b/apps/x.test.ts
@@ -1,2 +1,3 @@
 it('adds', () => {});
+it${'.skip'}('soon', () => {});
`;

const DELETE_FILE = `diff --git a/apps/x.test.ts b/apps/x.test.ts
deleted file mode 100644
index 1111111..0000000
--- a/apps/x.test.ts
+++ /dev/null
@@ -1,2 +0,0 @@
-import { expect, it } from 'vitest';
-it('x', () => { expect(1).toBe(1); });
`;

const CLEAN = `diff --git a/apps/x.test.ts b/apps/x.test.ts
--- a/apps/x.test.ts
+++ b/apps/x.test.ts
@@ -1,2 +1,3 @@
 it('adds', () => {
+  expect(add(1, 1)).toBe(2);
 });
`;

const IDS = Array.from({ length: 15 }, (_, i) => `Q${i + 1}`);
const qTable = (omit: string[] = []): string =>
  IDS.filter((id) => !omit.includes(id))
    .map((id) => `${id} pass`)
    .join('\n');

const body = (omit: string[] = []): string => `## What changed and why

Adds the quality gate.

## How to try it

Run \`pnpm quality\`.

## What must be decided

Nothing.

${qTable(omit)}
`;

describe('weakened tests', () => {
  it('Q2 reports a removed assertion line', () => {
    expect(weakenedTests(DELETE_ASSERTION)).toEqual(['apps/x.test.ts: removed assertion']);
  });

  it('Q2 reports a new .skip declaration', () => {
    expect(weakenedTests(ADD_SKIP)).toEqual(['apps/x.test.ts: added .skip']);
  });

  it('Q2 reports a deleted test file once', () => {
    expect(weakenedTests(DELETE_FILE)).toEqual(['apps/x.test.ts: deleted test file']);
  });

  it('Q2 passes a diff that only adds assertions', () => {
    expect(weakenedTests(CLEAN)).toEqual([]);
  });
});

describe('quality evidence', () => {
  it('Q12 accepts all 15 ids and the three sections', () => {
    expect(missingAttributes(body())).toEqual([]);
    expect(missingSections(body())).toEqual([]);
  });

  it('Q15 reports a body that omits the merge-keeps-main-green line', () => {
    expect(missingAttributes(body(['Q15']))).toEqual(['Q15']);
  });

  it('Q12 rejects a Q line with no verdict', () => {
    expect(missingAttributes(`${qTable(['Q7'])}\nQ7 Machine labels:`)).toEqual(['Q7']);
  });

  it('Q12 accepts a Q line that carries a verdict', () => {
    expect(missingAttributes(`${qTable(['Q7'])}\nQ7 Machine labels: pass`)).toEqual([]);
  });

  it('Q12 leaves the untouched PR template failing until a verdict is filled in', () => {
    const template = readFileSync(
      new URL('../.github/pull_request_template.md', import.meta.url),
      'utf8',
    );
    expect(missingAttributes(template)).toHaveLength(15);
  });

  it('Q12 reports exactly the missing id and section', () => {
    const partial = `## What changed and why

Adds the gate.

## How to try it

Run it.

${qTable(['Q7'])}`;
    expect(missingAttributes(partial)).toEqual(['Q7']);
    expect(missingSections(partial)).toEqual(['What must be decided']);
  });

  it('Q14 keeps REVIEW equal to the review rows in the contract', () => {
    const doc = readFileSync(new URL('../docs/QUALITY-ATTRIBUTES.md', import.meta.url), 'utf8');
    const reviewRows = [...doc.matchAll(/^\|\s*(Q\d+)\s*\|.*\|\s*review\s*\|/gm)].map((m) => m[1]);
    expect(reviewRows.join(' ')).toBe(REVIEW);
  });

  it('Q12 accepts a Preview line and a Decisions line', () => {
    const text = `## What changed\n\nPreview: http://127.0.0.1:3000/x\nDecisions: none\n\n${qTable()}`;
    expect(missingAttributes(text)).toEqual([]);
    expect(missingSections(text)).toEqual([]);
  });
});

describe('push guard', () => {
  it('Q1 refuses a HEAD with nothing ahead of main', () => {
    const refusal = pushRefusal(0, []);
    expect(refusal).toContain('no commits ahead of origin/main');
    expect(refusal).toContain('rebase');
  });

  it('Q1 refuses a tree with unresolved conflicts and names the paths', () => {
    const refusal = pushRefusal(3, ['apps/web/src/a.ts', 'tools/b.ts']);
    expect(refusal).toContain('apps/web/src/a.ts');
    expect(refusal).toContain('tools/b.ts');
  });

  it('Q1 allows a branch that is ahead with a clean tree', () => {
    expect(pushRefusal(5, [])).toBeNull();
  });
});
