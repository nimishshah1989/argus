import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { V2_VIEWS, viewsFrom } from './v2-views.js';

const loader = () => Promise.resolve({ default: () => null });

describe('the gallery views of the v2 screens', () => {
  it('finds a view from its file name alone: ?view=v2-<name>', () => {
    const found = viewsFrom({
      './v2-demo-view.tsx': loader,
      './v2-two-words-view.tsx': loader,
      './v2-preview.ts': loader,
      './chart-door-view.tsx': loader,
      './v2-demo-view.test.tsx': loader,
    });
    expect(Object.keys(found)).toEqual(['v2-demo', 'v2-two-words']);
  });

  it('serves every v2-<name>-view.tsx file in the gallery folder, under the same URLs as before', () => {
    const files = readdirSync(new URL('.', import.meta.url)).filter((f) =>
      /^v2-[a-z0-9-]+-view\.tsx$/.test(f),
    );
    const keys = files.map((f) => f.replace(/-view\.tsx$/, ''));
    expect(Object.keys(V2_VIEWS).sort()).toEqual(keys.sort());
    for (const key of [
      'v2-dashboard',
      'v2-team-focus',
      'v2-compare',
      'v2-action-center',
      'v2-data-checklist',
    ])
      expect(V2_VIEWS).toHaveProperty(key);
  });
});
