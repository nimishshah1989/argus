// @vitest-environment node
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { FormField } from './crud-model.js';
import { Field } from './form-sheet.js';

const choice = (n: number): FormField => ({
  name: 'kind',
  label: 'Kind',
  kind: 'choice',
  choices: Array.from({ length: n }, (_, i) => ({ value: `k${i}`, label: `K${i}` })),
});
const draw = (field: FormField, value = '') =>
  renderToStaticMarkup(createElement(Field, { field, value, onChange: () => undefined }));

/** v1's form-sheet rule the kit keeps (ADR 0044, ADR 0053): up to four choices are a bar of buttons, more are a menu. */
describe('kit form field: choice', () => {
  it('draws four choices as a labelled bar of buttons, the chosen one pressed', () => {
    const html = draw(choice(4), 'k1');
    expect(html).toContain('role="group" aria-label="Kind"');
    expect(html).not.toContain('<select');
    expect([...html.matchAll(/aria-pressed="(true|false)"/g)].map((m) => m[1])).toEqual([
      'false',
      'true',
      'false',
      'false',
    ]);
  });

  it('draws five or more choices as a menu', () => {
    const html = draw(choice(5));
    expect(html).toContain('<select');
    expect(html).not.toContain('aria-pressed');
  });
});
