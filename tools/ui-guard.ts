import type { UiFile } from './check-ui.js';

/**
 * The design-language guard (ticket 82). Over `screens/` and `components/` it counts raw colours and
 * hand-written cards, so ticket 86 and 87 can bring both to 0. It only reports now.
 */

/** Flip to true in ticket 87, once the findings are 0: `pnpm ui:check` then fails on any finding. */
export const FAIL_ON_FINDINGS = false;

export type FindingKind = 'raw colour' | 'hand-written card';
export interface Finding {
  path: string;
  line: number;
  kind: FindingKind;
}

const SHOWN = 10;
const SCOPE = /^(screens|components)\/.+\.tsx?$/;
const TEST_FILE = /\.test\.tsx?$/;

const HEX = /(?<![\w&])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/;
const FUNCTION_COLOUR = /\b(?:rgba?|hsla?|oklch|oklab|lch|lab)\(/;
// A Tailwind palette class that the tokens do not define (`bg-red-500`, `text-gray-600`, `border-white`).
const NAMED_CLASS =
  /\b(?:bg|text|border|ring|fill|stroke|from|via|to|outline|divide|shadow)-(?:white|black|(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|stone)-\d{2,3})\b/;
// A colour word as a CSS-in-JS value (`color: 'red'`, `{ background: "white" }`).
const NAMED_VALUE =
  /\b(?:color|background(?:Color)?|fill|stroke|border(?:Color)?)\s*:\s*['"](?:white|black|red|green|blue|yellow|orange|purple|pink|gray|grey|teal|cyan|brown)['"]/;

// How a card is hand-written today: a rounded-xl or rounded-2xl box on the surface colour (`bg-surface`, or `bg-white`). `ui/card.tsx` is the one card.
const CARD =
  /\brounded-(?:xl|2xl)\b.*\bbg-(?:surface|white)\b|\bbg-(?:surface|white)\b.*\brounded-(?:xl|2xl)\b/;

const isComment = (line: string): boolean => /^\s*(?:\/\/|\/?\*)/.test(line);
const hasColour = (line: string): boolean =>
  [HEX, FUNCTION_COLOUR, NAMED_CLASS, NAMED_VALUE].some((pattern) => pattern.test(line));

export function guardFindings(files: UiFile[]): Finding[] {
  const found: Finding[] = [];
  for (const { path, text } of files) {
    if (!SCOPE.test(path) || TEST_FILE.test(path)) continue;
    text.split('\n').forEach((line, i) => {
      if (isComment(line)) return;
      if (hasColour(line)) found.push({ path, line: i + 1, kind: 'raw colour' });
      if (CARD.test(line)) found.push({ path, line: i + 1, kind: 'hand-written card' });
    });
  }
  return found;
}

/** A short per-file summary, the worst file first, then the totals. */
export function guardSummary(findings: Finding[]): string[] {
  const perFile = new Map<string, { colours: number; cards: number }>();
  for (const { path, kind } of findings) {
    const row = perFile.get(path) ?? { colours: 0, cards: 0 };
    if (kind === 'raw colour') row.colours += 1;
    else row.cards += 1;
    perFile.set(path, row);
  }
  const rows = [...perFile].sort((a, b) => b[1].colours + b[1].cards - (a[1].colours + a[1].cards));
  const lines = rows
    .slice(0, SHOWN)
    .map(([path, r]) => `  ${path}: ${r.colours} raw colour(s), ${r.cards} card(s)`);
  if (rows.length > SHOWN) lines.push(`  ... and ${rows.length - SHOWN} more file(s)`);
  const colours = findings.filter((f) => f.kind === 'raw colour').length;
  const cards = findings.length - colours;
  return [
    ...lines,
    `ui guard: ${colours} raw colour(s), ${cards} hand-written card(s) in ${rows.length} file(s)`,
  ];
}
