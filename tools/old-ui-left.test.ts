import { describe, expect, it } from 'vitest';
import { galleryOldImports, oldTsxOnDisk, oldUiLeft, reachable } from './old-ui-left.js';

const ROOT = new URL('..', import.meta.url).pathname;

// Every old-design component the shipped app still renders. This list may only shrink:
// a new entry fails (nothing new on the old kit), and a fixed entry must be crossed off here.
// "Nothing old remains" (ADR 0055) is done when this list is empty.
const OLD_LEFT: string[] = [];

describe('nothing old remains (ADR 0051, ADR 0055)', () => {
  it('the shipped app reaches its screens', () => {
    const files = reachable(ROOT);
    expect(files).toContain('App.tsx');
    expect(files.some((f) => f.startsWith('screens/v2/'))).toBe(true);
    expect(files.some((f) => f.startsWith('gallery/'))).toBe(false);
  });

  it('renders no old-design component beyond the shrinking list', () => {
    expect(oldUiLeft(ROOT)).toEqual([...OLD_LEFT].sort());
  });

  // Nimish, 26 Nov: "all old stuff removed". Not even dead code: no .tsx outside the v2 kit and the gallery.
  it('keeps no old-design .tsx on disk', () => {
    expect(oldTsxOnDisk(ROOT)).toEqual([]);
  });

  it('the gallery imports no old-design .tsx', () => {
    expect(galleryOldImports(ROOT)).toEqual([]);
  });
});
