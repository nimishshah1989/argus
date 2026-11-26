import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { v1PageErrors } from '../no-v1-pages.js';

function plant(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'no-v1-pages-edges-'));
  for (const [path, body] of Object.entries(files)) {
    const full = join(root, 'apps/web/src', path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, body);
  }
  return root;
}

const page = 'export function X() { return null; }\n';

describe('no v1 pages: edges', () => {
  it('reads a route written over several lines, with props, inside a map', () => {
    const root = plant({
      'App.tsx': [
        "import { Settings } from './screens/Settings.js';",
        "import { Desk } from './screens/Desk.js';",
        '{PAGES.map(({ page }) => (',
        '  <Route',
        '    key={page}',
        '    path={`/settings/${page}`}',
        '    element={<Settings page={page} />}',
        '  />',
        '))}',
        '<Route path="/desk/mine" element={<Desk view="mine" />} />',
      ].join('\n'),
      'screens/Settings.tsx': page,
      'screens/Desk.tsx': page,
    });
    const errors = v1PageErrors(root);
    expect(errors).toHaveLength(2);
    expect(errors.join('\n')).toMatch(/screens\/Settings\.tsx/);
    expect(errors.join('\n')).toMatch(/screens\/Desk\.tsx/);
  });

  it('one of several names from the same import line is still resolved', () => {
    const root = plant({
      'App.tsx': [
        'import {',
        '  ActionCenterRoute,',
        '  AnalyticsFace,',
        "} from './screens/analytics/Analytics.js';",
        '<Route path="/analytics/:group" element={<AnalyticsFace />} />',
      ].join('\n'),
      'screens/analytics/Analytics.tsx': page,
    });
    expect(v1PageErrors(root)).toHaveLength(1);
  });

  it('a v2 file may import v1-located .ts logic but not a top-level screens/*.tsx or a faces/ component', () => {
    const root = plant({
      'App.tsx': '',
      'screens/v2/a/View.tsx': [
        "import { actAs } from '../../../faces/signin/act-as.js';",
        "import { tickets } from '../../desk/views.js';",
        "import { Desk } from '../../Desk.js';",
        "import { Notice } from '../../../faces/signin/parts.js';",
      ].join('\n'),
      'faces/signin/act-as.ts': page,
      'faces/signin/parts.tsx': page,
      'screens/desk/views.ts': page,
      'screens/Desk.tsx': page,
    });
    const errors = v1PageErrors(root).join('\n');
    expect(errors).toMatch(/screens\/Desk\.tsx/);
    expect(errors).toMatch(/faces\/signin\/parts\.tsx/);
    expect(errors).not.toMatch(/act-as|views/);
  });

  it('a v2 file importing another v2 .tsx is fine', () => {
    const root = plant({
      'App.tsx': '',
      'screens/v2/a/View.tsx': "import { B } from '../b/View.js';\n",
      'screens/v2/b/View.tsx': page,
    });
    expect(v1PageErrors(root)).toEqual([]);
  });
});
