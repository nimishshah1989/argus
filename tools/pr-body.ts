import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { HARD, countChanged } from './check-pr-size.js';
import { changelogErrors, type ChangedFile } from './check-changelog.js';
import { parityUpdateErrors } from './check-parity-update.js';
import { missingAttributes, missingSections, weakenedTests } from './check-quality.js';

/**
 * `pnpm pr:body --what "..." --try "..."` prints a PR description that passes `pnpm quality:pr` as is: the template's
 * headings, every Q line with a verdict read off the diff, and the reason lines CI looks for. A verdict that needs a
 * human's ruling is written as `fail — ...`, never `pending`; `--q Q3="pass"` replaces one. The template is read from
 * `.github/pull_request_template.md`, so a new attribute there shows up here.
 */

export interface PrFacts {
  files: ChangedFile[];
  changed: number;
  weakened: string[];
}

export interface PrInput {
  what: string;
  how: string;
  decide?: string;
  ran?: string;
  large?: string;
  noParity?: string;
  testsRemoved?: string;
  session?: string;
  verdicts?: Record<string, string>;
}

const UI_FILE = /^apps\/web\/src\/.+\.(?:tsx|css)$/;
const TEST = /\.(?:test|spec)\.tsx?$/;
const E2E = /\.spec\.ts$/;
const DOCS = /^(?:docs|changes|wiki)\/|\.md$/;
const SERVER = /^(?:apps\/server|packages|scripts|infra)\/|\.sql$/;
/** Where a PR changes only the v2 gallery: v1 behaviour is untouched, so the parity ledger has nothing to say. */
const GALLERY_ONLY = /^apps\/web\/(?:src\/(?:gallery|screens\/v2|ui\/v2)|e2e\/gallery)\//;
const GALLERY_REASON = 'v2 gallery-only screen work; no v1 behaviour changes';

const ruled = (what: string) => `fail — ${what}; the builder rules it (pnpm pr:body --q)`;

/** The verdict for one attribute, read off the diff; the ones a diff cannot prove are ruled by the builder. */
export function verdictFor(id: string, f: PrFacts, input: PrInput): string {
  const paths = f.files.map((file) => file.path);
  const any = (re: RegExp) => paths.some((path) => re.test(path));
  const code = paths.some((path) => !DOCS.test(path));
  const ui = paths.some((path) => UI_FILE.test(path) && !TEST.test(path));
  const server = any(SERVER);
  const rules: Record<string, () => string> = {
    Q1: () =>
      any(TEST) ? 'pass' : code ? 'fail — no test file in this diff' : 'n/a — no code changed',
    Q2: () =>
      f.weakened.length === 0
        ? 'pass'
        : input.testsRemoved
          ? `pass — ${input.testsRemoved}`
          : `fail — ${f.weakened.join('; ')}`,
    Q3: () => (server ? ruled('server or shared code changed') : 'n/a — no server code changed'),
    Q4: () => (server ? ruled('server or shared code changed') : 'n/a — no server code changed'),
    Q5: () =>
      any(/migrations\//) ? ruled('a migration changed') : 'n/a — no migration or data change',
    Q6: () => 'pass — pr:size and the file budgets run in CI',
    Q7: () => (ui ? 'pass — pnpm ui:check runs in CI' : 'n/a — no screen or style changed'),
    Q8: () =>
      !ui
        ? 'n/a — no screen or style changed'
        : any(E2E)
          ? 'pass'
          : 'fail — no axe spec in this diff',
    Q9: () => (ui ? 'pass — lint blocks a literal string' : 'n/a — no screen text changed'),
    Q10: () =>
      any(/^packages\/domain\//) ? ruled('the engine changed') : 'n/a — no engine change',
    Q11: () =>
      server || any(/^(?:\.github|tools)\//)
        ? ruled('a server, deploy or tool change')
        : 'n/a — no server, deploy or runtime change',
    Q12: () => {
      const errors = changelogErrors(f.files);
      return errors.length === 0 ? 'pass' : `fail — ${errors.join('; ')}`;
    },
    Q13: () => 'pass — pii:scan and the secret scan run in CI',
    Q14: () => 'n/a — a separate reviewer reads it when the PR is ready',
    Q15: () => 'pass — CI runs the full suite on the ready PR before merge',
  };
  return input.verdicts?.[id] ?? rules[id]?.() ?? ruled('no default rule for this attribute');
}

/** The `Large PR:`, `No parity:` and `Tests removed:` lines this diff needs, and what is missing to write them. */
export function reasonLines(f: PrFacts, input: PrInput): { lines: string[]; problems: string[] } {
  const lines: string[] = [];
  const problems: string[] = [];
  if (f.changed > HARD) {
    if (input.large) lines.push(`Large PR: ${input.large}`);
    else problems.push(`${f.changed} changed lines is over ${HARD}: pass --large "<reason>"`);
  }
  if (parityUpdateErrors(f.files.map((file) => file.path)).length > 0) {
    const product = f.files.filter((file) => /^(?:apps|packages)\//.test(file.path));
    const reason =
      input.noParity ??
      (product.every((file) => GALLERY_ONLY.test(file.path)) ? GALLERY_REASON : '');
    if (reason) lines.push(`No parity: ${reason}`);
    else
      problems.push(
        'product files changed without docs/spec/parity.yaml: pass --no-parity "<reason>"',
      );
  }
  if (f.weakened.length === 0) lines.push('Tests removed: none');
  else if (input.testsRemoved) lines.push(`Tests removed: ${input.testsRemoved}`);
  return { lines, problems };
}

const stripComments = (text: string) => text.replace(/<!--[\s\S]*?-->/g, '');

/** A checklist line is ticked when the command it names between backticks is among those `--ran` lists. */
function tick(line: string, ran: string): string {
  const command = /`([^`]+)`/.exec(line)?.[1];
  return command && ran.includes(command) ? line.replace('- [ ]', '- [x]') : line;
}

function sectionBody(heading: string, template: string, f: PrFacts, input: PrInput): string[] {
  const name = heading.toLowerCase();
  if (name.includes('what changed')) return [input.what];
  if (name.includes('try')) return [input.how];
  if (name.includes('decid')) return [input.decide ?? 'None.'];
  if (name.includes('quality')) {
    return [...template.matchAll(/^(Q\d+ [^:\n]+): <verdict>$/gm)].map(
      (m) => `${m[1]}: ${verdictFor(m[1]!.split(' ')[0]!, f, input)}`,
    );
  }
  if (name.includes('verification')) {
    const items = template
      .replace(/\n[ \t]+(?=\S)/g, ' ')
      .split('\n')
      .filter((line) => line.startsWith('- ['));
    const ran = input.ran ?? '';
    return [...items.map((line) => tick(line, ran)), ...(ran ? [`Ran: ${ran}`] : [])];
  }
  if (name.includes('reasons')) return reasonLines(f, input).lines.concat('');
  return ['None.'];
}

/** The PR description for these facts; throws with every reason it cannot, so a missing flag is never a silent gap. */
export function buildBody(template: string, f: PrFacts, input: PrInput): string {
  const problems = reasonLines(f, input).problems;
  if (!input.what.trim()) problems.push('pass --what "<what changed for a user, and why>"');
  if (!input.how.trim()) problems.push('pass --try "<how to try it>"');
  const sections = template.split(/^## /m).slice(1);
  const out = sections.map((section) => {
    const [heading = '', ...rest] = section.split('\n');
    const body = sectionBody(heading, stripComments(rest.join('\n')), f, input);
    return `## ${heading.trim()}\n\n${body.join('\n').trim()}\n`;
  });
  const footer = input.session
    ? `\n🤖 Generated with [Claude Code](https://claude.com/claude-code)\n\n${input.session}\n`
    : '';
  const body = `${out.join('\n')}${footer}`;
  const lacking = [...missingAttributes(body).map((id) => id), ...missingSections(body)];
  if (lacking.length > 0) problems.push(`the template gives no ${lacking.join(', ')}`);
  if (problems.length > 0) throw new Error(problems.join('\n'));
  return body;
}

function git(...args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 1 << 28 });
}

function gather(): PrFacts {
  const range = 'origin/main...HEAD';
  const files = git('diff', '--name-status', '--no-renames', range)
    .split('\n')
    .filter(Boolean)
    .map((line) => ({ status: line.split('\t')[0] ?? '', path: line.split('\t')[1] ?? '' }));
  const { changed } = countChanged(git('diff', '--numstat', range));
  return { files, changed, weakened: weakenedTests(git('diff', range)) };
}

/** `--q Q3=pass --q "Q11=n/a — no runtime change"` as an id to verdict map. */
export function parseVerdicts(pairs: string[]): Record<string, string> {
  const verdicts: Record<string, string> = {};
  for (const pair of pairs) {
    const at = pair.indexOf('=');
    if (at < 1) throw new Error(`--q wants Q<n>=<verdict>, got "${pair}"`);
    verdicts[pair.slice(0, at).trim()] = pair.slice(at + 1).trim();
  }
  return verdicts;
}

function main(): void {
  const { values } = parseArgs({
    options: {
      what: { type: 'string' },
      try: { type: 'string' },
      decide: { type: 'string' },
      ran: { type: 'string' },
      large: { type: 'string' },
      'no-parity': { type: 'string' },
      'tests-removed': { type: 'string' },
      session: { type: 'string' },
      q: { type: 'string', multiple: true },
    },
  });
  try {
    const template = readFileSync(
      new URL('../.github/pull_request_template.md', import.meta.url),
      'utf8',
    );
    const body = buildBody(template, gather(), {
      what: values.what ?? '',
      how: values.try ?? '',
      decide: values.decide,
      ran: values.ran,
      large: values.large,
      noParity: values['no-parity'],
      testsRemoved: values['tests-removed'],
      session: values.session,
      verdicts: parseVerdicts(values.q ?? []),
    });
    process.stdout.write(body);
  } catch (error) {
    console.error(`pr:body: ${(error as Error).message}`);
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
