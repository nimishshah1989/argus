// Ticket 50a: the FullCalendar door and chunk guard (ADR 0009 R1), mirroring the ECharts guard. The library is
// reached only through one lazy page, so it is a separate chunk and never a start-up file, and our own code
// never targets its hashed `.fc-*` class names (v7 may change them; the tokens and `[data-date]` are the hooks).
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

interface SrcFile {
  path: string;
  text: string;
}

const SRC = join(dirname(fileURLToPath(import.meta.url)), '../..');
const WEB = join(SRC, '..');
const E2E = join(WEB, 'e2e');
const DOOR = 'screens/analytics/PmCalendar.tsx';
const PAGE = 'PmCalendarPage';

function readTree(root: string, dir = root, accept = /\.(tsx?|css)$/): SrcFile[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return readTree(root, full, accept);
    if (!accept.test(entry.name) || entry.name.endsWith('.test.ts')) return [];
    return [{ path: relative(root, full).split('\\').join('/'), text: readFileSync(full, 'utf8') }];
  });
}

const readSrc = (): SrcFile[] => readTree(SRC);
const readSelectors = (): SrcFile[] => [...readTree(SRC), ...readTree(E2E)];

const STATIC = /\b(?:import|export)\s+(?:type\s+)?[^;'"]*?\bfrom\s*'([^']+)'/g;
const BARE = /\bimport\s*'([^']+)'/g;
const DYNAMIC = /\bimport\(\s*'([^']+)'\s*\)/g;
const FULLCALENDAR = /^@fullcalendar(?:\/|$)|^@full-ui(?:\/|$)/;
const SELECTOR = /\.fc-[a-z0-9_-]+/g;

interface Hit {
  index: number;
  specifier: string;
  staticValue: boolean;
}

function hitsOf(text: string): Hit[] {
  const hits: Hit[] = [];
  for (const m of text.matchAll(STATIC))
    hits.push({ index: m.index, specifier: m[1]!, staticValue: true });
  for (const m of text.matchAll(BARE))
    hits.push({ index: m.index, specifier: m[1]!, staticValue: true });
  for (const m of text.matchAll(DYNAMIC))
    hits.push({ index: m.index, specifier: m[1]!, staticValue: false });
  return hits.sort((a, b) => a.index - b.index);
}

const at = (path: string, text: string, index: number): string =>
  `${path}:${text.slice(0, index).split('\n').length}`;

/** FullCalendar may only be named by the door; the door's static imports are fine because the page is lazy. */
function fullCalendarErrors(files: SrcFile[]): string[] {
  return files.flatMap(({ path, text }) =>
    hitsOf(text)
      .filter((hit) => FULLCALENDAR.test(hit.specifier))
      .flatMap((hit) =>
        path === DOOR ? [] : [`${at(path, text, hit.index)}: @fullcalendar outside ${DOOR}`],
      ),
  );
}

/** With the door in place, the page that mounts it is only ever reached through `import()`. */
function lazyPageErrors(files: SrcFile[]): string[] {
  if (!files.some((file) => file.path === DOOR)) return [];
  const errors: string[] = [];
  let lazy = 0;
  for (const { path, text } of files) {
    for (const hit of hitsOf(text)) {
      if (!hit.specifier.includes(PAGE)) continue;
      if (hit.staticValue)
        errors.push(`${at(path, text, hit.index)}: the PM page must be a lazy import()`);
      else lazy += 1;
    }
  }
  if (lazy === 0) errors.push(`no lazy import() of ${PAGE} reaches ${DOOR}`);
  return errors;
}

/** `.fc-*` is the library's hashed DOM; our CSS and our tests target tokens, `[data-date]` and text instead. */
function selectorErrors(files: SrcFile[]): string[] {
  return files.flatMap(({ path, text }) =>
    [...text.matchAll(SELECTOR)].map((match) => `${at(path, text, match.index)}: ${match[0]}`),
  );
}

describe('the FullCalendar door (ADR 0009)', () => {
  it('pins the family exactly and lists every installed licence', () => {
    const pkg = JSON.parse(readFileSync(join(WEB, 'package.json'), 'utf8')) as {
      dependencies: Record<string, string>;
    };
    expect(pkg.dependencies['@fullcalendar/react']).toBe('7.1.5');
    expect(pkg.dependencies['temporal-polyfill']).toBe('1.0.8');
    const third = readFileSync(join(WEB, '..', '..', 'THIRD_PARTY.md'), 'utf8');
    expect(third).toContain('@fullcalendar/core');
    expect(third).toContain('@full-ui/headless-calendar');
    expect(third).toContain('temporal-polyfill');
  });

  it('names FullCalendar only in the one door and reaches its page lazily', () => {
    const files = readSrc();
    expect(fullCalendarErrors(files)).toEqual([]);
    expect(lazyPageErrors(files)).toEqual([]);
  });

  it('flags a planted import outside the door and a static import of the lazy page', () => {
    const files: SrcFile[] = [
      { path: 'faces/x.tsx', text: "import FullCalendar from '@fullcalendar/react';" },
      {
        path: DOOR,
        text: "import FullCalendar from '@fullcalendar/react';\nimport dayGrid from '@fullcalendar/daygrid';",
      },
      { path: 'gallery/y.ts', text: "const m = await import('@full-ui/headless-calendar');" },
      {
        path: 'screens/analytics/Analytics.tsx',
        text: "import { x } from './PmCalendarPage.js';",
      },
    ];
    expect(fullCalendarErrors(files)).toEqual([
      'faces/x.tsx:1: @fullcalendar outside screens/analytics/PmCalendar.tsx',
      'gallery/y.ts:1: @fullcalendar outside screens/analytics/PmCalendar.tsx',
    ]);
    expect(lazyPageErrors(files)).toContain(
      'screens/analytics/Analytics.tsx:1: the PM page must be a lazy import()',
    );
  });

  it('never targets the library class names in our CSS or tests', () => {
    expect(selectorErrors(readSelectors())).toEqual([]);
    expect(
      selectorErrors([{ path: 'pm-calendar.css', text: '.fc-daygrid-day { color: red; }' }]),
    ).toEqual(['pm-calendar.css:1: .fc-daygrid-day']);
  });

  it('the build keeps the calendar out of the start-up files', { timeout: 180_000 }, () => {
    const out = mkdtempSync(join(tmpdir(), 'uptimo-pm-'));
    try {
      execFileSync(
        join(WEB, 'node_modules/.bin/vite'),
        ['build', '--outDir', out, '--emptyOutDir', '--logLevel', 'error'],
        { cwd: WEB, env: { ...process.env, NODE_ENV: 'production' } },
      );
      const html = readFileSync(join(out, 'index.html'), 'utf8');
      const start = [
        ...html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g),
        ...html.matchAll(/<link[^>]*\srel="modulepreload"[^>]*\shref="([^"]+)"/g),
        ...html.matchAll(/<link[^>]*\srel="stylesheet"[^>]*\shref="([^"]+)"/g),
      ].map((m) => m[1]!.replace(/^\//, ''));
      const marker = 'fc-classic-';
      const has = (file: string): boolean => readFileSync(join(out, file), 'utf8').includes(marker);
      expect(start.length).toBeGreaterThan(0);
      expect(start.filter(has)).toEqual([]);

      const assets = readdirSync(join(out, 'assets'))
        .filter((name) => /\.(js|css)$/.test(name))
        .map((name) => `assets/${name}`);
      const withMarker = assets.filter(has);
      const doorExists = readSrc().some((file) => file.path === DOOR);
      if (doorExists) {
        expect(withMarker.length).toBeGreaterThan(0);
        expect(withMarker.every((file) => /PmCalendar/.test(file))).toBe(true);
      } else {
        // 50a installs the dependency before 50c adds the door: nothing may load it yet.
        expect(withMarker).toEqual([]);
      }
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });
});
