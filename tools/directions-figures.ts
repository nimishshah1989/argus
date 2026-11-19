import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_PROFILE } from '../packages/shared/src/index.js';
import { run, type FigureResult } from '../packages/domain/src/index.js';
import { ENGINE_DATA } from '../packages/domain/test/answer-key/fixture.js';

/**
 * The design preview's figures (ticket 80, packet 80g). The three directions print the plant's real figure shapes,
 * so this runs the engine's pure `run()` on the frozen answer key (11 Nov 2026) and keeps the screens the preview
 * draws: the dashboard, the machine page (one machine), the breakdown log and the four breakdown analyses. Drill
 * ids are dropped and every table is cut to 50 rows, so the file stays small and holds only fixture data.
 *
 *   pnpm tsx tools/directions-figures.ts           writes the snapshot
 *   pnpm tsx tools/directions-figures.ts --check   exits 1 when it is missing or stale
 */

const AS_OF = '2026-11-11';
const MACHINE = 'VC-28';
const MAX_ROWS = 50;
const KEEP_SCREENS = new Set(['dashboard']);
const KEEP_KEYS = new Set([
  'machine-page',
  'breakdown-log',
  'a1-bd-pm',
  'a2-category-cell',
  'a3-mttr-mtbf',
  'a10-problems',
]);
const OUT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../apps/web/src/gallery/directions/generated/figures.json',
);

/** Every `rows` list (a table's body) cut to its first 50 rows, however deep it sits. */
function cut(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cut);
  if (typeof value !== 'object' || value === null) return value;
  const out: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value)) {
    out[key] =
      key === 'rows' && Array.isArray(inner) ? inner.slice(0, MAX_ROWS).map(cut) : cut(inner);
  }
  return out;
}

/** The machine page's value holds all 192 machines; the preview draws one. */
function oneMachine(value: unknown): unknown {
  const byMachine = (value as { byMachine: Record<string, unknown> }).byMachine;
  const machine = byMachine[MACHINE];
  if (machine === undefined) throw new Error(`the answer key has no machine ${MACHINE}`);
  return { byMachine: { [MACHINE]: machine } };
}

function keep(figure: FigureResult): FigureResult {
  const value = figure.key === 'machine-page' ? oneMachine(figure.value) : figure.value;
  return {
    ...figure,
    value: cut(value) as FigureResult['value'],
    drill: { ...figure.drill, ids: [] },
  };
}

function snapshot(): string {
  const result = run(ENGINE_DATA, AS_OF, DEFAULT_PROFILE);
  const figures = result.figures
    .filter((figure) => KEEP_SCREENS.has(figure.screen) || KEEP_KEYS.has(figure.key))
    .map(keep);
  return `${JSON.stringify({ asOf: result.asOf, figures })}\n`;
}

function main(): void {
  const fresh = snapshot();
  if (process.argv.includes('--check')) {
    const current = existsSync(OUT) ? readFileSync(OUT, 'utf8') : null;
    if (current === fresh) return;
    console.error(
      `${current === null ? 'missing' : 'stale'}: run pnpm tsx tools/directions-figures.ts`,
    );
    process.exit(1);
  }
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, fresh);
  console.log(`wrote ${OUT} (${Buffer.byteLength(fresh)} bytes)`);
}

main();
