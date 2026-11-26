// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import { Navigate } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ANALYTICS_GROUPS } from '../analytics/groups.js';
import { fallbackScreen, liveScreen } from './live.js';

const target = (element: ReturnType<typeof liveScreen>) =>
  element?.type === Navigate ? (element.props as { to: string }).to : null;

describe('ADR 0051: no analytics address renders a v1 page', () => {
  it('an unknown ?screen= in every group draws a v2 screen or sends to one', () => {
    for (const { id } of ANALYTICS_GROUPS)
      expect(liveScreen(id, 'no-such-screen'), id).not.toBeNull();
  });

  it('the fallback sends each group to its own first screen, which is live and not another redirect', () => {
    for (const { id } of ANALYTICS_GROUPS) {
      const to = target(fallbackScreen(id));
      expect(to, id).toMatch(new RegExp(`^/analytics/${id}\\?screen=[a-z0-9-]+$`));
      const screen = new URLSearchParams(to?.split('?')[1]).get('screen');
      const drawn = liveScreen(id, screen);
      expect(drawn, `${id} ${screen}`).not.toBeNull();
      expect(drawn?.type, `${id} ${screen}`).not.toBe(Navigate);
    }
  });

  it('the analytics face has no v1 fallback', () => {
    const face = readFileSync(new URL('../analytics/Analytics.tsx', import.meta.url), 'utf8');
    expect(face).not.toMatch(/GroupPage|AnalyticsShell/);
  });

  it('the v1 analytics page chain is deleted', () => {
    for (const file of [
      'GroupPage.tsx',
      'FigureTile.tsx',
      'PageFigure.tsx',
      'shell/AnalyticsShell.tsx',
    ])
      expect(existsSync(new URL(`../analytics/${file}`, import.meta.url)), file).toBe(false);
  });
});
