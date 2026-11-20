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
    const sub = "import Ban from 'lucide-react/icons/ban';";
    expect(check({ 'screens/x.tsx': line, 'screens/y.tsx': sub, 'ui/icon.ts': line })).toEqual([
      'screens/x.tsx:1: lucide-react outside ui/icon.ts',
      'screens/y.tsx:1: lucide-react outside ui/icon.ts',
    ]);
  });

  it('passes a clean tree and an absent faces folder', () => {
    expect(check({ 'faces/desk/ok.tsx': 'export const a = <Stack gap={4} />;' })).toEqual([]);
    expect(check({ 'screens/x.tsx': 'export const a = 1;' })).toEqual([]);
  });

  it('flags colour, font size, font weight and animation in a v2 screen', () => {
    const errors = check({
      'screens/v2/a/View.tsx': [
        "const c = '#dc2626';",
        '<p style={{ fontSize: 13 }} />',
        '<p className="font-bold" />',
        '@keyframes spin {}',
        '// a comment may say font-size and #fff',
      ].join('\n'),
    });
    expect(errors).toEqual([
      'screens/v2/a/View.tsx:1: raw colour in screens/v2/',
      'screens/v2/a/View.tsx:2: font size in screens/v2/',
      'screens/v2/a/View.tsx:3: font weight in screens/v2/',
      'screens/v2/a/View.tsx:4: animation in screens/v2/',
    ]);
  });

  it('checks code that follows a comment on the same line', () => {
    expect(check({ 'screens/v2/a/View.tsx': "/* note */ const c = '#ffffff';" })).toEqual([
      'screens/v2/a/View.tsx:1: raw colour in screens/v2/',
    ]);
  });

  it('flags named colours, colour declarations and palette classes in a v2 screen', () => {
    const errors = check({
      'screens/v2/a/View.tsx': [
        "const s = { color: 'red' };",
        '<rect fill="tomato" />',
        "const tone = 'white';",
        '<p className="bg-red-500" />',
        '<path fill="none" stroke="currentColor" />',
      ].join('\n'),
    });
    expect(errors).toEqual([
      'screens/v2/a/View.tsx:1: raw colour in screens/v2/',
      'screens/v2/a/View.tsx:2: raw colour in screens/v2/',
      'screens/v2/a/View.tsx:3: raw colour in screens/v2/',
      'screens/v2/a/View.tsx:4: raw colour in screens/v2/',
    ]);
  });

  it("flags the project's size classes and arbitrary sizes in a v2 screen", () => {
    const errors = check({
      'screens/v2/a/View.tsx': [
        '<p className="text-body" />',
        '<p className="text-[14px]" />',
      ].join('\n'),
    });
    expect(errors).toEqual([
      'screens/v2/a/View.tsx:1: font size in screens/v2/',
      'screens/v2/a/View.tsx:2: font size in screens/v2/',
    ]);
  });

  it('lets a v2 screen compose the kit and print copy, and leaves the kit itself alone', () => {
    expect(
      check({
        'screens/v2/a/View.tsx': '<Panel title={words.title}><Row>{children}</Row></Panel>',
        'screens/v2/a/fixture.ts': "const note = 'A smooth transition to the new shift';",
        'ui/v2/kit.tsx': "const s = { color: '#fff', fontSize: 12, animation: 'none' };",
      }),
    ).toEqual([]);
  });

  describe('entity links', () => {
    it('keeps the code class to the chip: it fails anywhere else, passes in the chip', () => {
      const line = '<span className="v2-code">x</span>';
      expect(check({ 'ui/v2/domain/row.tsx': line })).toEqual([
        'ui/v2/domain/row.tsx:1: v2-code outside entity-chip.tsx; use EntityChip',
      ]);
      expect(check({ 'ui/v2/entity-chip.tsx': line })).toEqual([]);
    });

    it('fails a code printed as JSX text in a screen or a domain part, and passes attributes and chips', () => {
      const bad = ['<p>{m.code}</p>', '<p>{d.codes.join(", ")}</p>'].join('\n');
      expect(check({ 'screens/v2/a/View.tsx': bad, 'ui/v2/domain/b.tsx': bad })).toEqual([
        'screens/v2/a/View.tsx:1: a code printed as text; use EntityChip',
        'screens/v2/a/View.tsx:2: a code printed as text; use EntityChip',
        'ui/v2/domain/b.tsx:1: a code printed as text; use EntityChip',
        'ui/v2/domain/b.tsx:2: a code printed as text; use EntityChip',
      ]);
      const good = [
        '<tr key={m.code} data-code={m.code} aria-label={`${m.code}, ${m.cell}`}>',
        '{d.codes.map((c) => <EntityChip key={c.id} {...c} />)}',
        'sortBy: (m) => m.code,',
      ].join('\n');
      expect(
        check({ 'screens/v2/a/View.tsx': good, 'ui/v2/other.tsx': '<p>{m.code}</p>' }),
      ).toEqual([]);
    });

    it('fails a code inside a sentence in a fixture, and passes a bare code, a chip and an allowed line', () => {
      const bad = ["const a = 'Worst on VC-67 (13)';", 'const b = "Moved TC-4 to Friday";'].join(
        '\n',
      );
      expect(check({ 'screens/v2/a/fixture.ts': bad })).toEqual([
        'screens/v2/a/fixture.ts:1: entity code in text; write {{machine:CODE|CODE}}',
        'screens/v2/a/fixture.ts:2: entity code in text; write {{machine:CODE|CODE}}',
      ]);
      const good = [
        "const a = 'Worst on {{machine:VC-67|VC-67}} (13)';",
        "const codes = ['VC-67', 'TC-4'];",
        "const c = 'Part TC-4 is quoted'; // ui-allow: entity-code a part number, not a machine",
        "const date = 'Friday 20-Nov-2026';",
        '// a note about TC-4 and "TC-4 here"',
      ].join('\n');
      expect(check({ 'screens/v2/a/fixture-text.ts': good })).toEqual([]);
    });

    it('fails a screen View that imports Shell, also over several lines, and passes EntityShell', () => {
      const one = "import { Shell, type NavItem } from '../../../ui/v2/shell.js';";
      const many = "import {\n  type NavItem,\n  Shell,\n} from '../../../ui/v2/shell';";
      expect(check({ 'screens/v2/a/View.tsx': one, 'screens/v2/b/View.tsx': many })).toEqual([
        'screens/v2/a/View.tsx:1: Shell in a screen View; use EntityShell',
        'screens/v2/b/View.tsx:1: Shell in a screen View; use EntityShell',
      ]);
      const ok = "import { EntityShell } from '../entity/EntityShell.js';";
      const type = "import type { NavItem } from '../../../ui/v2/shell.js';";
      expect(check({ 'screens/v2/a/View.tsx': `${ok}\n${type}` })).toEqual([]);
      expect(check({ 'screens/v2/entity/EntityShell.tsx': one })).toEqual([]);
    });
  });
});
