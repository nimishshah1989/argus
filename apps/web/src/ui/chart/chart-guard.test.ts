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
const DOOR = 'ui/chart/use-chart.ts';

function readSrc(dir = SRC): SrcFile[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return readSrc(full);
    if (!/\.tsx?$/.test(entry.name) || entry.name.endsWith('.test.ts')) return [];
    return [{ path: relative(SRC, full).split('\\').join('/'), text: readFileSync(full, 'utf8') }];
  });
}

const STATIC = /\b(?:import|export)\s+(type\s+)?[^;'"]*?\bfrom\s*'([^']+)'/g;
const BARE = /\bimport\s*'([^']+)'/g;
const DYNAMIC = /\bimport\(\s*'([^']+)'\s*\)/g;
const ECHARTS = /^echarts(?:\/|$)/;

interface Hit {
  index: number;
  specifier: string;
  staticValue: boolean;
}

function hitsOf(text: string): Hit[] {
  const hits: Hit[] = [];
  for (const m of text.matchAll(STATIC))
    hits.push({ index: m.index, specifier: m[2]!, staticValue: m[1] === undefined });
  for (const m of text.matchAll(BARE))
    hits.push({ index: m.index, specifier: m[1]!, staticValue: true });
  for (const m of text.matchAll(DYNAMIC))
    hits.push({ index: m.index, specifier: m[1]!, staticValue: false });
  return hits.sort((a, b) => a.index - b.index);
}

function echartsErrors(files: SrcFile[]): string[] {
  return files.flatMap(({ path, text }) =>
    hitsOf(text)
      .filter((h) => ECHARTS.test(h.specifier))
      .flatMap((h) => {
        const at = `${path}:${text.slice(0, h.index).split('\n').length}`;
        if (path !== DOOR) return [`${at}: echarts outside ${DOOR}`];
        return h.staticValue ? [`${at}: static echarts import; use import()`] : [];
      }),
  );
}

describe('chart guard', () => {
  it('echarts is reached only through import() in ui/chart/use-chart.ts', () => {
    const files = readSrc();
    expect(echartsErrors(files)).toEqual([]);
    expect(files.find((f) => f.path === DOOR)?.text).toMatch(/import\(\s*'echarts\/core'\s*\)/);
  });

  it('flags a planted echarts import outside the chart module and a static one inside it', () => {
    const files: SrcFile[] = [
      { path: 'faces/x.tsx', text: "import { init } from 'echarts/core';" },
      { path: 'patterns/y.tsx', text: "const a = 1;\nconst m = await import('echarts');" },
      {
        path: DOOR,
        text: "import type {\n  ComposeOption,\n} from 'echarts/core';\nimport { use } from 'echarts/core';\nconst c = import('echarts/charts');",
      },
      {
        path: 'gallery/z.ts',
        text: "// echarts is drawn by ui/chart\nimport { Chart } from '../ui/chart/chart.js';",
      },
    ];
    expect(echartsErrors(files)).toEqual([
      'faces/x.tsx:1: echarts outside ui/chart/use-chart.ts',
      'patterns/y.tsx:2: echarts outside ui/chart/use-chart.ts',
      'ui/chart/use-chart.ts:4: static echarts import; use import()',
    ]);
  });

  it('the gallery build keeps echarts out of the start-up files', { timeout: 60_000 }, () => {
    const out = mkdtempSync(join(tmpdir(), 'uptimo-chart-'));
    try {
      execFileSync(
        join(WEB, 'node_modules/.bin/vite'),
        ['build', '--outDir', out, '--emptyOutDir', '--logLevel', 'error'],
        { cwd: WEB, env: { ...process.env, NODE_ENV: 'production', VITE_GALLERY: 'on' } },
      );
      const html = readFileSync(join(out, 'index.html'), 'utf8');
      const start = [
        ...html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g),
        ...html.matchAll(/<link[^>]*rel="modulepreload"[^>]*\shref="([^"]+)"/g),
      ].map((m) => m[1]!.replace(/^\//, ''));
      const marker = '_echarts_instance_';
      const has = (file: string) => readFileSync(join(out, file), 'utf8').includes(marker);
      expect(start.length).toBeGreaterThan(0);
      expect(start.filter(has)).toEqual([]);
      const chunks = readdirSync(join(out, 'assets')).filter((f) => f.endsWith('.js'));
      const gallery = chunks.filter((f) => f.startsWith('Gallery-'));
      expect(gallery).toHaveLength(1);
      expect(has(`assets/${gallery[0]!}`)).toBe(false);
      expect(chunks.some((f) => has(`assets/${f}`))).toBe(true);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });
});
