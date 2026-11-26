// @vitest-environment node
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LookCell, leadOf } from './table-parts.js';

const cell = (text: string) =>
  renderToStaticMarkup(
    createElement(LookCell<string>, {
      column: { key: 'm', label: 'Method', cell: (row: string) => row },
      row: text,
      looks: { largest: {}, top: new Set<string>(), tint: false },
    }),
  );

const note =
  'each machine is rated on its own breakdowns, pulled towards the others of its own kind.';

describe('a long text cell (ADR 0065)', () => {
  it('shows the lead before the colon and keeps the rest behind a closed Details button', () => {
    const html = cell(`Current model in use: ${note}`);
    expect(html).toContain(`<strong>Current model in use</strong><span hidden="">: ${note}</span>`);
    expect(html).toContain('aria-expanded="false"');
  });

  it('clamps text with no lead to one line, and leaves short text as it was', () => {
    expect(cell(`E${note}`)).toContain('v2-longtext-clamp');
    expect(cell('Age + recent: Both changes together.')).toBe(
      'Age + recent: Both changes together.',
    );
    expect(leadOf('Stopped at 10:30 and again later')).toBeUndefined();
  });
});
