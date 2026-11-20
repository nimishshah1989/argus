import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { FAIL_ON_FINDINGS, guardFindings, guardSummary } from './ui-guard.js';

/**
 * UI guard (ticket 10, D20). Files under faces/ are built from the kit only: no className or
 * style, no raw colour, at most 120 lines per .tsx. lucide-react is imported only by ui/icon.ts.
 */

export interface UiFile {
  path: string; // relative to webSrc, '/' separators
  text: string;
}

const FACES_LINES = 120;
const FACES_RULES: [string, RegExp][] = [
  ['className in faces/', /\bclassName\s*=/],
  ['style in faces/', /\bstyle\s*=/],
  ['raw colour in faces/', /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch)\(/],
];
const LUCIDE = /['"]lucide-react(?:\/[^'"]*)?['"]/;

/**
 * v2 screens only compose the kit (docs/design/v2/LANGUAGE.md): colour, type size, weight and motion live in
 * ui/v2. A line that is only a comment may name them; code after a comment on the same line is still checked.
 */
const NAMED =
  'white|black|red|green|blue|yellow|orange|purple|pink|gray|grey|teal|cyan|brown|navy|maroon|olive|lime|silver|gold';
const PALETTE =
  'red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone';
const V2_SCREEN_RULES: [string, RegExp][] = [
  [
    'raw colour in screens/v2/',
    new RegExp(
      [
        String.raw`#[0-9a-fA-F]{3,8}\b`,
        String.raw`\b(?:rgba?|hsla?|oklch|oklab|lch|lab|color-mix)\(`,
        // A colour property given a literal value: `color: 'red'`, `fill="#fff"`, `background: "white"`.
        String.raw`\b(?:color|background(?:-?[cC]olor)?|fill|stroke|border-?[cC]olor|outline-?[cC]olor)\s*[:=]\s*\{?\s*['"\x60](?!none|currentColor|transparent|inherit)[^'"\x60]`,
        // A named colour as a value, or a Tailwind palette class (`bg-red-500`, `text-white`).
        String.raw`['"\x60](?:${NAMED})['"\x60]`,
        String.raw`\b(?:bg|text|border|ring|fill|stroke|outline|divide|from|via|to)-(?:white|black|(?:${PALETTE})-\d{2,3})\b`,
      ].join('|'),
      'i',
    ),
  ],
  [
    'font size in screens/v2/',
    /font-?size|fontSize|\btext-(?:xs|sm|base|lg|\d?xl|caption|footnote|body|title\d?|tv-\d+|v2-[\w-]+|\[[^\]]+\])(?![\w-])/i,
  ],
  [
    'font weight in screens/v2/',
    /font-?weight|fontWeight|\bfont-(?:thin|extralight|light|normal|medium|semibold|bold|extrabold|black)\b/i,
  ],
  // CSS or style syntax only, so copy that says "transition" passes.
  [
    'animation in screens/v2/',
    /@keyframes|\b(?:animation|transition)(?:-[\w-]+)?\s*:|\banimation(?:Name|Duration)?\s*:|\banimate-\w/i,
  ],
];
/**
 * Entity links (docs/slices/entity-links.md): a machine, cell, person or decision is always an `EntityChip`, so a
 * hand-drawn code or a code in a sentence is a mistake.
 */
const CODE_CLASS = /\bv2-code\b/;
/** `{m.code}` or `{d.codes.join(', ')}` as JSX text; an attribute (`key={m.code}`) and a template part pass. */
const CODE_AS_TEXT = /(?<![=\w$])\{\s*[\w.?]*\.codes?(?:\.join\([^)]*\))?\s*\}/;
const ENTITY_WORD = /\b[A-Z]{2,5}-\d{1,4}\b/;
const QUOTED = /'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`/g;
const ALLOW_CODE = /\/\/\s*ui-allow:\s*entity-code\s+\S/;
const SHELL_IMPORT =
  /import\s*(?:type\s*)?\{[^}]*\bShell\b[^}]*\}\s*from\s*['"][^'"]*ui\/v2\/shell(?:\.js)?['"]/;

/** Whether a line of a fixture writes an entity code inside a sentence instead of as `{{machine:CODE|CODE}}`. */
function codeInText(line: string): boolean {
  if (ALLOW_CODE.test(line)) return false;
  return (line.match(QUOTED) ?? []).some((q) => {
    const bare = q.replace(/\{\{[^}]*\}\}/g, '');
    return /\s/.test(bare) && ENTITY_WORD.test(bare);
  });
}

/** A line that is only a comment: a line comment, a whole block comment, or a line inside a block comment. */
const COMMENT_ONLY =
  /^\s*(?:\/\/.*|\/\*(?:(?!\*\/).)*(?:\*\/\s*)?|\*(?!\/)(?:(?!\*\/).)*(?:\*\/\s*)?|\*\/\s*)$/;

export function readWebSrc(webSrc: string): UiFile[] {
  const files: UiFile[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules') walk(full);
      } else if (/\.tsx?$/.test(entry.name)) {
        files.push({
          path: relative(webSrc, full).split('\\').join('/'),
          text: readFileSync(full, 'utf8'),
        });
      }
    }
  };
  walk(webSrc);
  return files;
}

const inKit = (path: string) => path.startsWith('screens/v2/') || path.startsWith('ui/v2/domain/');

/** The entity-link rules for one line (rules 1 to 3); a comment-only line is never wrong. */
function entityErrors(path: string, line: string, n: number): string[] {
  if (COMMENT_ONLY.test(line)) return [];
  const found: string[] = [];
  if (path !== 'ui/v2/entity-chip.tsx' && CODE_CLASS.test(line))
    found.push(`${path}:${n}: v2-code outside entity-chip.tsx; use EntityChip`);
  if (inKit(path) && path.endsWith('.tsx') && CODE_AS_TEXT.test(line))
    found.push(`${path}:${n}: a code printed as text; use EntityChip`);
  if (/^screens\/v2\/(?:.+\/)?fixture[^/]*\.ts$/.test(path) && codeInText(line))
    found.push(`${path}:${n}: entity code in text; write {{machine:CODE|CODE}}`);
  return found;
}

export function uiErrors(files: UiFile[]): string[] {
  const errors: string[] = [];
  for (const { path, text } of files) {
    const lines = text.replace(/\n$/, '').split('\n');
    const faces = path.startsWith('faces/');
    lines.forEach((line, i) => {
      if (faces)
        for (const [message, pattern] of FACES_RULES)
          if (pattern.test(line)) errors.push(`${path}:${i + 1}: ${message}`);
      if (path.startsWith('screens/v2/') && !COMMENT_ONLY.test(line))
        for (const [message, pattern] of V2_SCREEN_RULES)
          if (pattern.test(line)) errors.push(`${path}:${i + 1}: ${message}`);
      if (path !== 'ui/icon.ts' && LUCIDE.test(line))
        errors.push(`${path}:${i + 1}: lucide-react outside ui/icon.ts`);
      errors.push(...entityErrors(path, line, i + 1));
    });
    const shell = /^screens\/v2\/(?:.+\/)?View\.tsx$/.test(path) && SHELL_IMPORT.exec(text);
    if (shell) {
      const at = text.slice(0, shell.index).split('\n').length;
      errors.push(`${path}:${at}: Shell in a screen View; use EntityShell`);
    }
    if (faces && path.endsWith('.tsx') && lines.length > FACES_LINES)
      errors.push(`${path}: ${lines.length} lines (faces limit ${FACES_LINES})`);
  }
  return errors;
}

function main(): void {
  const files = readWebSrc(process.argv[2] ?? 'apps/web/src');
  const errors = uiErrors(files);
  console.log(`ui: ${files.length} files, ${errors.length} problem(s)`);
  for (const error of errors) console.error(`ui: ${error}`);
  const findings = guardFindings(files);
  for (const line of guardSummary(findings)) console.log(line);
  if (errors.length > 0 || (FAIL_ON_FINDINGS && findings.length > 0)) process.exitCode = 1;
  else if (findings.length > 0) console.log('ui guard: warning only until ticket 87');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
