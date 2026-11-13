import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const json = (path: string) => JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;

function tsFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : tsFiles(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
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

  it('declares every @uptimo import of the web', () => {
    const used = new Set(
      ['apps/web/src', 'apps/web/e2e'].flatMap((dir) =>
        tsFiles(dir).flatMap((file) =>
          [...readFileSync(file, 'utf8').matchAll(/from '(@uptimo\/[a-z]+)/g)].map((m) => m[1]),
        ),
      ),
    );
    const dependencies = json('apps/web/package.json').dependencies as Record<string, string>;
    expect(used.size).toBeGreaterThan(0);
    for (const name of ['@uptimo/domain', '@uptimo/shared']) {
      expect(dependencies[name], name).toBe('workspace:*');
    }
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

  it('keeps no hand-written API types in the web', () => {
    expect(existsSync('apps/web/src/api-types.ts')).toBe(false);
    for (const file of [...tsFiles('apps/web/src'), ...tsFiles('apps/web/e2e')]) {
      expect(readFileSync(file, 'utf8'), file).not.toContain('api-types');
    }
    const names =
      'Ticket State Config TicketDetail TicketPage Machine Segment Group ListItem Person Shift Figures BreakdownReport TicketEvent TicketPerson TicketInterval'.split(
        ' ',
      );
    const api = readFileSync('apps/web/src/api.ts', 'utf8');
    for (const name of names)
      expect(api, name).not.toMatch(new RegExp(`(interface|type) ${name}\\b`));
  });

  it('takes the contract types in the domain from shared', () => {
    const source = tsFiles('packages/domain/src')
      .map((file) => readFileSync(file, 'utf8'))
      .join('\n');
    for (const decl of [
      'type Criticality =',
      'type Severity =',
      'type SlaTimerState =',
      'interface SeverityMatrix',
      'interface SlaPolicy',
    ]) {
      expect(source, decl).not.toContain(decl);
    }
    const dependencies = json('packages/domain/package.json').dependencies as Record<
      string,
      string
    >;
    expect(dependencies['@uptimo/shared']).toBe('workspace:*');
  });
});
