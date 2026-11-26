// @vitest-environment node
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { Navigate } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { liveScreen } from '../live.js';

const analytics = new URL('../../analytics/', import.meta.url);

/** Every .ts/.tsx file under screens/analytics, recursively. */
function files(dir: URL): URL[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? files(new URL(`${entry.name}/`, dir))
      : /\.tsx?$/.test(entry.name)
        ? [new URL(entry.name, dir)]
        : [],
  );
}

describe('ADR 0051 no v1 fallback: edges', () => {
  it('reports and guide with an unknown ?screen= draw v2', () => {
    for (const group of ['reports', 'guide']) {
      const drawn = liveScreen(group, 'nope');
      expect(drawn, group).not.toBeNull();
      if (drawn?.type === Navigate)
        expect((drawn.props as { to: string }).to).toMatch(
          new RegExp(`^/analytics/${group}\\?screen=`),
        );
    }
  });

  it('an empty ?screen= is a miss, not a v1 page', () => {
    for (const group of ['today', 'breakdowns', 'reports', 'guide', 'cost', 'pm'])
      expect(liveScreen(group, ''), group).not.toBeNull();
  });

  it('an unknown group is not this function’s business: it stays null (the face redirects to Today)', () => {
    expect(liveScreen('no-such-group', 'x')).toBeNull();
    expect(liveScreen(undefined, null)).toBeNull();
  });

  it('no file under screens/analytics renders AnalyticsShell or GroupPage', () => {
    for (const file of files(analytics))
      expect(readFileSync(file, 'utf8'), file.pathname).not.toMatch(
        /<(AnalyticsShell|GroupPage)\b/,
      );
  });

  it('every file on the delete list is gone', () => {
    for (const name of [
      'GroupPage.tsx',
      'FigureTile.tsx',
      'DrillTable.tsx',
      'PageFigure.tsx',
      'parts.tsx',
      'EnergyGrids.tsx',
      'sort-table.tsx',
      'shell/AnalyticsShell.tsx',
      'shell/ShellPalette.tsx',
      'shell/shell-header.tsx',
      'shell/shell.css',
      'key-screen.tsx',
      'screen-menu.tsx',
      'KeyPage.tsx',
      'key-body.tsx',
      'screen-state.tsx',
      'screen-states.tsx',
      'engine-table.tsx',
      'engine-table-model.ts',
    ])
      expect(existsSync(new URL(name, analytics)), name).toBe(false);
  });
});
