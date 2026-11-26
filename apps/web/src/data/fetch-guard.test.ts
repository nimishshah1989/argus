import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

interface SrcFile {
  path: string;
  text: string;
}
interface Exception {
  file: string;
  until: string;
}

/** Dated, shrinking: an exception whose file is clean is itself an error. */
const EXCEPTIONS: Exception[] = [
  { file: 'screens/v2/desk/pdf.ts', until: 'ticket 18: the day-report and ticket PDFs are blobs' },
];

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..');

function readSrc(dir = SRC): SrcFile[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return readSrc(full);
    if (!/\.tsx?$/.test(entry.name) || entry.name.endsWith('.test.ts')) return [];
    return [{ path: relative(SRC, full).split('\\').join('/'), text: readFileSync(full, 'utf8') }];
  });
}

const RAW_FETCH = /\bfetch\(|XMLHttpRequest|\bsendBeacon\(/;
const SPECIFIER = /(?:from|import\()\s*'([^']+)'/;
const DEEP_DATA = /(?:^|\/)data\/(?!index\.js$)/;
const SEND_COMMAND = /\bsendCommand\(/;

const ALLOWED = (path: string): boolean =>
  path.startsWith('data/') || path === 'sw.ts' || path === 'offline/replay.ts';

function fileErrors({ path, text }: SrcFile): string[] {
  const hits: string[] = [];
  text.split('\n').forEach((line, i) => {
    const at = `${path}:${i + 1}`;
    if (RAW_FETCH.test(line)) hits.push(`${at}: raw fetch outside data/`);
    const specifier = SPECIFIER.exec(line)?.[1];
    if (specifier && DEEP_DATA.test(specifier)) hits.push(`${at}: data/ reached past data/index`);
    if (SEND_COMMAND.test(line)) hits.push(`${at}: sendCommand outside the outbox replay`);
  });
  return hits;
}

function fetchErrors(files: SrcFile[], exceptions: Exception[]): string[] {
  const excused = new Set(exceptions.map((e) => e.file));
  const errors = files.filter((f) => !ALLOWED(f.path) && !excused.has(f.path)).flatMap(fileErrors);
  const stale = exceptions
    .filter((e) => !files.some((f) => f.path === e.file && fileErrors(f).length > 0))
    .map((e) => `${e.file}: EXCEPTIONS lists it but it is clean; remove it`);
  return [...errors, ...stale];
}

describe('fetch guard', () => {
  it('defineResource and useCommand are the only fetch path in apps/web/src', () => {
    expect(fetchErrors(readSrc(), EXCEPTIONS)).toEqual([]);
  });

  it('flags a planted raw fetch, a deep data import and a direct sendCommand', () => {
    const files: SrcFile[] = [
      { path: 'screens/x.tsx', text: "const r = await fetch('/api/v1/x');" },
      { path: 'faces/y.ts', text: "import { http } from '../data/client.js';" },
      { path: 'components/z.ts', text: "const a = 1;\nsendCommand(id, 'close', {}, key);" },
      { path: 'data/client.ts', text: "fetch(x);\nsendCommand(a, 'b', {}, k);" },
      { path: 'sw.ts', text: "fetch(x);\nsendCommand(a, 'b', {}, k);" },
      { path: 'offline/replay.ts', text: "fetch(x);\nsendCommand(a, 'b', {}, k);" },
      {
        path: 'gallery/a.tsx',
        text: "import { defineResource } from '../data/index.js'; q.refetch(); q.fetchNextPage();",
      },
    ];
    expect(fetchErrors(files, [])).toEqual([
      'screens/x.tsx:1: raw fetch outside data/',
      'faces/y.ts:1: data/ reached past data/index',
      'components/z.ts:2: sendCommand outside the outbox replay',
    ]);
  });

  it('honours a dated exception and reports a stale one', () => {
    // Its own list: the live EXCEPTIONS shrink as tickets land (screens/Login.tsx went with ticket 21).
    const dated: Exception[] = [
      { file: 'screens/Login.tsx', until: 'a planted exception' },
      { file: 'screens/desk/MinePanel.tsx', until: 'a planted exception' },
    ];
    const files: SrcFile[] = [
      { path: 'screens/Login.tsx', text: "await fetch('/api/v1/auth/login');" },
      { path: 'screens/desk/MinePanel.tsx', text: 'const a = 1;' },
    ];
    expect(fetchErrors(files, dated)).toEqual([
      'screens/desk/MinePanel.tsx: EXCEPTIONS lists it but it is clean; remove it',
    ]);
  });
});
