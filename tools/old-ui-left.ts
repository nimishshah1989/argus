// "Nothing old remains" (ADR 0051, ADR 0055), as a measurement instead of a promise.
// Walks the imports the shipped app actually reaches from apps/web/src/main.tsx and lists every
// reachable .tsx component that is not on the v2 kit (screens/v2, ui/v2). Logic (.ts) is allowed
// in old folders (ADR 0051 keeps it); the dev-only /gallery is not shipped and is not walked.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const WEB_SRC = 'apps/web/src';

// Infrastructure, not design: the app entry, the router and the shared ECharts wrapper.
export const NOT_DESIGN = new Set(['main.tsx', 'App.tsx', 'ui/chart/chart.tsx']);

const IMPORT =
  /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;

function resolveImport(fromFile: string, spec: string): string | null {
  if (!spec.startsWith('.')) return null;
  const base = resolve(dirname(fromFile), spec).replace(/\.js$/, '');
  for (const ext of ['.tsx', '.ts', '/index.tsx', '/index.ts']) {
    if (existsSync(base + ext)) return base + ext;
  }
  return null;
}

/** Every file the shipped app reaches from main.tsx, as paths relative to apps/web/src. */
export function reachable(root: string): string[] {
  const src = join(root, WEB_SRC);
  const seen = new Set<string>();
  const stack = [join(src, 'main.tsx')];
  while (stack.length > 0) {
    const file = stack.pop() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(IMPORT)) {
      const next = resolveImport(file, m[1] ?? m[2] ?? '');
      if (next && !relative(src, next).startsWith('gallery/')) stack.push(next);
    }
  }
  return [...seen].map((f) => relative(src, f).split('\\').join('/')).sort();
}

/** Old-design components the shipped app still renders. Done means this is empty. */
export function oldUiLeft(root: string): string[] {
  return reachable(root).filter(
    (f) =>
      f.endsWith('.tsx') &&
      !f.endsWith('.test.tsx') &&
      !f.startsWith('screens/v2/') &&
      !f.startsWith('ui/v2/') &&
      !NOT_DESIGN.has(f),
  );
}
