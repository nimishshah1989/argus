import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const json = (path: string) => JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;

function tsFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : tsFiles(path);
    return entry.name.endsWith('.ts') ? [path] : [];
  });
}

describe('workspace packages', () => {
  it('gives every package an exports map', () => {
    for (const name of ['db', 'domain', 'shared']) {
      const exportsMap = json(`packages/${name}/package.json`).exports as Record<string, string>;
      expect(exportsMap['.'], name).toBe('./src/index.ts');
    }
  });

  it('declares every @uptimo import of the server', () => {
    const used = new Set(
      tsFiles('apps/server/src').flatMap((file) =>
        [...readFileSync(file, 'utf8').matchAll(/from '(@uptimo\/[a-z]+)/g)].map((m) => m[1]),
      ),
    );
    const dependencies = json('apps/server/package.json').dependencies as Record<string, string>;
    for (const name of used) expect(dependencies[name as string], name).toBe('workspace:*');
  });

  it('resolves packages without aliases', () => {
    const tsconfig = JSON.parse(readFileSync('tsconfig.json', 'utf8')) as {
      compilerOptions: Record<string, unknown>;
    };
    expect(tsconfig.compilerOptions.paths).toBeUndefined();
    expect(readFileSync('vitest.config.ts', 'utf8')).not.toContain('alias');
    expect(readFileSync('scripts/build-server.ts', 'utf8')).not.toContain('alias');
  });
});
