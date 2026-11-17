import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SCRIPT = fileURLToPath(new URL('./changed-areas.sh', import.meta.url));

type Areas = { server: boolean; web: boolean; gallery: boolean };

/** Run the gate exactly as ci.yml does: one positional path per changed file, no arguments for an empty diff. */
function areas(paths: string[]): Areas {
  const out = execFileSync('bash', [SCRIPT, ...paths], { encoding: 'utf8' }).trim();
  const flag = (name: keyof Areas) => new RegExp(`${name}=(true|false)`).exec(out)?.[1] === 'true';
  return { server: flag('server'), web: flag('web'), gallery: flag('gallery') };
}

describe('changed-areas', () => {
  it('runs the server suite for a migration outside apps/server', () => {
    expect(areas(['db/migrations/0007_kpi.sql'])).toEqual({
      server: true,
      web: false,
      gallery: false,
    });
  });

  it('runs the server suite for a package manifest outside apps/server', () => {
    expect(areas(['packages/shared/package.json'])).toEqual({
      server: true,
      web: false,
      gallery: false,
    });
  });

  it('runs the web suite for a catalogue outside apps/web', () => {
    expect(areas(['packages/shared/src/i18n/board.en.ts'])).toMatchObject({ web: true });
  });

  it('runs the web suite for the root playwright config', () => {
    expect(areas(['playwright.config.ts'])).toMatchObject({ web: true });
  });

  it('runs the gallery for a pattern it renders', () => {
    expect(areas(['apps/web/src/patterns/queue-page.tsx'])).toEqual({
      server: false,
      web: true,
      gallery: true,
    });
  });

  it('runs the gallery for a gallery catalogue', () => {
    expect(areas(['packages/shared/src/i18n/gallery.en.ts'])).toMatchObject({ gallery: true });
  });

  it('runs every suite for the lockfile', () => {
    expect(areas(['pnpm-lock.yaml'])).toEqual({ server: true, web: true, gallery: true });
  });

  it('runs every suite for a root manifest or compiler config', () => {
    for (const path of ['package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts']) {
      expect(areas([path]), path).toEqual({ server: true, web: true, gallery: true });
    }
  });

  it('keeps a nested config in the web suite only', () => {
    expect(areas(['apps/web/vite.config.ts'])).toEqual({
      server: false,
      web: true,
      gallery: false,
    });
  });

  it('skips every suite for a docs-only change', () => {
    expect(areas(['docs/HANDOFF.md', 'README.md'])).toEqual({
      server: false,
      web: false,
      gallery: false,
    });
  });

  it('skips every suite for an empty path list', () => {
    expect(areas([])).toEqual({ server: false, web: false, gallery: false });
  });

  it('runs server and web for a mixed change, gallery only if it renders', () => {
    expect(
      areas([
        'apps/server/src/routes/health.ts',
        'apps/web/src/app/page.tsx',
        'apps/web/src/gallery/Gallery.tsx',
      ]),
    ).toEqual({ server: true, web: true, gallery: true });
  });
});
