import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { v1PageErrors } from './no-v1-pages.js';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');

/** A throwaway repo holding only the given files under `apps/web/src/`. */
function plant(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'no-v1-pages-'));
  for (const [path, body] of Object.entries(files)) {
    const full = join(root, 'apps/web/src', path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, body);
  }
  return root;
}

const page = 'export function X() { return null; }\n';

describe('no v1 pages (ADR 0051)', () => {
  it('this repo routes only to v2 screens, and no v2 screen draws a v1 component', () => {
    expect(v1PageErrors(repo)).toEqual([]);
  });

  it('allows v2 routes, redirects and the gallery', () => {
    const root = plant({
      'App.tsx': [
        "import { Navigate, Route } from 'react-router-dom';",
        "import { SignInView } from './screens/v2/sign-in/View.js';",
        "const Gallery = lazy(() => import('./gallery/Gallery.js'));",
        '<Route path="/login" element={<SignInView />} />',
        '<Route path="/" element={<Navigate to="/login" replace />} />',
        '<Route path="/gallery" element={<Gallery />} />',
      ].join('\n'),
      'screens/v2/sign-in/View.tsx':
        "import { groupFor } from '../../analytics/groups.js';\n" + page,
      'screens/analytics/groups.ts': 'export const groupFor = 1;\n',
      'gallery/Gallery.tsx': page,
    });
    expect(v1PageErrors(root)).toEqual([]);
  });

  it('names a route that renders a v1 page', () => {
    const root = plant({
      'App.tsx': [
        "import { Who } from './faces/signin/who.js';",
        '<Route path="/who" element={<Who />} />',
      ].join('\n'),
      'faces/signin/who.tsx': page,
    });
    const errors = v1PageErrors(root);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/\/who/);
    expect(errors[0]).toMatch(/faces\/signin\/who\.tsx/);
  });

  it('names a v2 screen that imports a v1 component', () => {
    const root = plant({
      'App.tsx': '',
      'screens/v2/oem/View.tsx':
        "import { GroupPage } from '../../analytics/GroupPage.js';\n" + page,
      'screens/analytics/GroupPage.tsx': page,
    });
    const errors = v1PageErrors(root);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/screens\/v2\/oem\/View\.tsx/);
    expect(errors[0]).toMatch(/screens\/analytics\/GroupPage\.tsx/);
  });
});
