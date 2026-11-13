import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readWebSrc, uiErrors } from './check-ui.js';

function check(files: Record<string, string>): string[] {
  const dir = mkdtempSync(join(tmpdir(), 'ui-'));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
  return uiErrors(readWebSrc(dir));
}

describe('check-ui', () => {
  it('flags className in a faces file', () => {
    expect(check({ 'faces/desk/open.tsx': '<Stack className="p-4" />' })).toEqual([
      'faces/desk/open.tsx:1: className in faces/',
    ]);
  });

  it('flags a style attribute in a faces file', () => {
    expect(check({ 'faces/desk/open.tsx': '<Stack style={{}} />' })).toContain(
      'faces/desk/open.tsx:1: style in faces/',
    );
  });

  it('flags raw colours in faces', () => {
    const errors = check({
      'faces/floor/a.ts': "const c = '#dc2626';",
      'faces/floor/b.tsx': 'const x = 1;\nconst c = `rgb(0, 0, 0)`;',
    });
    expect(errors).toContain('faces/floor/a.ts:1: raw colour in faces/');
    expect(errors).toContain('faces/floor/b.tsx:2: raw colour in faces/');
  });

  it('flags a faces screen over 120 lines', () => {
    const lines = (n: number) => Array.from({ length: n }, () => 'const a = 1;').join('\n');
    expect(check({ 'faces/desk/long.tsx': lines(121), 'faces/desk/ok.tsx': lines(120) })).toEqual([
      'faces/desk/long.tsx: 121 lines (faces limit 120)',
    ]);
  });

  it('flags lucide-react outside ui/icon.ts', () => {
    const line = "import { Ban } from 'lucide-react';";
    expect(check({ 'screens/x.tsx': line, 'ui/icon.ts': line })).toEqual([
      'screens/x.tsx:1: lucide-react outside ui/icon.ts',
    ]);
  });

  it('passes a clean tree and an absent faces folder', () => {
    expect(check({ 'faces/desk/ok.tsx': 'export const a = <Stack gap={4} />;' })).toEqual([]);
    expect(check({ 'screens/x.tsx': 'export const a = 1;' })).toEqual([]);
  });
});
