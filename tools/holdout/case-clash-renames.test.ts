import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// git, not the disk: a Mac disk answers "yes" to a path in the wrong case.
const tracked = new Set(
  execFileSync('git', ['ls-files', '-z', '--', 'apps/web/src/screens/v2'], { encoding: 'utf8' })
    .split('\0')
    .filter(Boolean),
);
const V2 = 'apps/web/src/screens/v2';
const read = (path: string) => (existsSync(path) ? readFileSync(path, 'utf8') : '');

describe('the case-clash renames', () => {
  it('renames the two components and keeps the two modules', () => {
    for (const path of ['dashboard/BubbleChart.tsx', 'why-why/WhyWhyLive.tsx'])
      expect(tracked.has(`${V2}/${path}`), path).toBe(true);
    for (const path of ['dashboard/Bubble.tsx', 'why-why/Live.tsx'])
      expect(tracked.has(`${V2}/${path}`), path).toBe(false);
    for (const path of ['dashboard/bubble.ts', 'why-why/live.ts'])
      expect(tracked.has(`${V2}/${path}`), path).toBe(true);
  });

  it('keeps the exported names and points every importer at the new files', () => {
    expect(read(`${V2}/dashboard/BubbleChart.tsx`)).toMatch(/export function Bubble\b/);
    expect(read(`${V2}/why-why/WhyWhyLive.tsx`)).toMatch(/export function WhyWhyLive\b/);
    expect(read(`${V2}/dashboard/View.tsx`)).toContain(
      "import { Bubble } from './BubbleChart.js';",
    );
    expect(read(`${V2}/live.tsx`)).toContain(
      "import { WhyWhyLive } from './why-why/WhyWhyLive.js';",
    );
  });
});
