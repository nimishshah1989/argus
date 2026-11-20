/**
 * Q16 "Scope kept" (docs/QUALITY-ATTRIBUTES.md, docs/design/v2/COVERAGE.md). A PR that changes a v2 screen
 * must carry its coverage table in the body (`## Coverage`) and in `docs/design/v2/scope/<screen>.md`, and no
 * row whose `v2` column says MISSING or DROPPED may lack `Nimish said yes: <date>`. The scanners are pure so
 * they are testable without git or CI. They prove the table exists and is clean, not that it is true.
 */

const SCREEN_FILE = /^apps\/web\/src\/screens\/v2\/([^/]+)\/.+\.tsx$/;
const TEST_FILE = /\.test\.tsx?$/;
const BLOCKING = /\b(?:MISSING|DROPPED)\b/i;
const SIGNED_OFF =
  /nimish said yes:\s*(?:\d{4}-\d{2}-\d{2}|\d{1,2}[ -][A-Za-z]{3,9}[ -]\d{4})\s*\.?$/i;

export interface CoverageTable {
  header: string[];
  rows: string[][];
}

export function scopePath(screen: string): string {
  return `docs/design/v2/scope/${screen}.md`;
}

/** The v2 screen folders that a diff changes in a non-test `.tsx` file. */
export function changedScreens(paths: string[]): string[] {
  const screens = paths
    .filter((path) => !TEST_FILE.test(path))
    .map((path) => SCREEN_FILE.exec(path)?.[1])
    .filter((screen): screen is string => screen !== undefined);
  return [...new Set(screens)].sort();
}

function cells(line: string): string[] {
  const inner = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return inner.split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/\\\|/g, '|'));
}

const isSeparator = (line: string): boolean => /^\|?[\s:|-]*-[\s:|-]*\|?$/.test(line.trim());

/** Every markdown table in the text, with its header cells and its data rows. */
function tables(text: string): CoverageTable[] {
  const found: CoverageTable[] = [];
  let current: string[] = [];
  const flush = (): void => {
    const [head, sep, ...rows] = current;
    if (head !== undefined && sep !== undefined && isSeparator(sep))
      found.push({ header: cells(head), rows: rows.map(cells) });
    current = [];
  };
  for (const line of [...text.split('\n'), '']) {
    if (line.trim().startsWith('|')) current.push(line);
    else flush();
  }
  return found;
}

const v2Column = (table: CoverageTable): number =>
  table.header.findIndex((name) => name.toLowerCase() === 'v2');

/** The coverage tables in the text: the ones with a column named exactly `v2`. */
export function coverageTables(text: string): CoverageTable[] {
  return tables(text.replace(/<!--[\s\S]*?-->/g, '')).filter((table) => v2Column(table) >= 0);
}

/** The text under a `## Coverage` heading, up to the next heading of level 1 or 2. */
export function coverageSection(body: string): string | null {
  const text = body.replace(/<!--[\s\S]*?-->/g, '');
  const start = /^##[ \t]+coverage[ \t]*$/im.exec(text);
  if (!start) return null;
  const rest = text.slice(start.index + start[0].length);
  const next = /^#{1,2}[ \t]+\S/m.exec(rest);
  return next ? rest.slice(0, next.index) : rest;
}

/** The rows of the tables that stop the PR: MISSING or DROPPED in `v2` with no `Nimish said yes: <date>`. */
export function unsignedRows(tablesIn: CoverageTable[]): string[] {
  const found: string[] = [];
  for (const table of tablesIn) {
    const col = v2Column(table);
    for (const row of table.rows) {
      if (!BLOCKING.test(row[col] ?? '')) continue;
      const last = [...row].reverse().find((cell) => cell.length > 0) ?? '';
      if (SIGNED_OFF.test(row[col] ?? '') || SIGNED_OFF.test(last)) continue;
      found.push((row[0] ?? '').slice(0, 60) || '(unnamed row)');
    }
  }
  return found;
}

function tableProblems(where: string, tablesIn: CoverageTable[]): string[] {
  if (tablesIn.every((table) => table.rows.length === 0))
    return [`${where}: add a coverage table (a \`v2\` column and at least one data row)`];
  return unsignedRows(tablesIn).map(
    (item) => `${where}: "${item}" is MISSING or DROPPED without "Nimish said yes: <date>"`,
  );
}

export interface CoverageInput {
  body: string;
  changed: string[];
  read: (path: string) => string | null;
}

/** The reasons a PR that changes v2 screens does not carry its coverage, one line each; empty when it does. */
export function coverageProblems({ body, changed, read }: CoverageInput): string[] {
  const screens = changedScreens(changed);
  if (screens.length === 0) return [];
  const section = coverageSection(body);
  const problems =
    section === null
      ? ['PR body: add a `## Coverage` section with the coverage table']
      : tableProblems('PR body `## Coverage`', coverageTables(section));
  for (const screen of screens) {
    const path = scopePath(screen);
    const text = changed.includes(path) ? read(path) : null;
    if (text === null)
      problems.push(`${path}: commit the coverage table for screens/v2/${screen}/`);
    else problems.push(...tableProblems(path, coverageTables(text)));
  }
  return problems;
}
