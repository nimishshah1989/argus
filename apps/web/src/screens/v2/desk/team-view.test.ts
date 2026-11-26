// @vitest-environment node
import { createElement as h, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import '../../../i18n/index.js';
import { realT } from '../printed-page/test-support.js';
import { MineView, type MineViewProps } from './MineView.js';
import { mineModel, teamModel } from './team-adapter.js';
import { mineFixture, teamFixture } from './team-fixture.js';
import { TeamView } from './TeamView.js';

/**
 * S28-B (ADR 0045 T4): Mine and Team draw the names the e2e specs find (desk, desk-lists, desk-paging) and keep
 * v1's control order (`e2e/gallery/desk-order.spec.ts` MINE and TEAM, LOCK rule 1). The frame (h1, Account, tabs)
 * is the Page's, not the View's.
 */
function wrap(view: ReactNode): string {
  return renderToStaticMarkup(
    h(QueryClientProvider, { client: new QueryClient() }, h(MemoryRouter, null, view)),
  );
}

const team = () => wrap(h(TeamView, { model: teamModel(teamFixture, realT) }));
const mine = (props: Partial<MineViewProps> = {}) =>
  wrap(
    h(MineView, {
      model: mineModel(mineFixture, realT),
      pending: false,
      onQuick: () => undefined,
      onDayReport: () => undefined,
      dayReportFailed: false,
      ...props,
    }),
  );

const text = (inner: string) =>
  inner
    .replace(/<[^>]+>/g, '')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

/** `controlOrder` from `e2e/gallery/desk-mock.ts`: every heading, link and button as "tag: label or text". */
function controls(html: string): string[] {
  const found: string[] = [];
  const tag = /<(h1|h2|h3|a|button)\b([^>]*)>([\s\S]*?)<\/\1>/g;
  for (let m = tag.exec(html); m; m = tag.exec(html)) {
    const label = /aria-label="([^"]*)"/.exec(m[2] ?? '')?.[1];
    found.push(`${m[1]}: ${label ?? text(m[3] ?? '')}`);
  }
  return found;
}

function expectOrder(html: string, expected: RegExp[]) {
  const got = controls(html);
  expect(got, got.join('\n')).toHaveLength(expected.length);
  got.forEach((control, i) => expect(control, `control ${i}`).toMatch(expected[i]!));
}

/** The inner HTML of each element carrying `attr`. */
function regions(html: string, attr: string): string[] {
  const out: string[] = [];
  const open = new RegExp(`<(section|div|ul)\\b[^>]*${attr}[^>]*>`, 'g');
  for (let m = open.exec(html); m; m = open.exec(html)) {
    const name = m[1]!;
    let depth = 1;
    let at = m.index + m[0].length;
    const step = new RegExp(`<(/?)${name}\\b[^>]*>`, 'g');
    step.lastIndex = at;
    for (let s = step.exec(html); s && depth > 0; s = step.exec(html)) {
      depth += s[1] ? -1 : 1;
      at = s.index;
    }
    out.push(html.slice(m.index, at));
  }
  return out;
}

describe('Mine keeps v1’s control order', () => {
  it('In progress card and its quick button, Waiting card and its button, closed rows, Day report last', () => {
    expectOrder(mine(), [
      /^h2: In progress$/,
      /^a: LT-08\s*TKT-0409/,
      /^button: Machine running/,
      /^h2: Waiting$/,
      /^a: GRD-07\s*TKT-0392/,
      /^button: Resume work/,
      /^h2: Closed, last 30 days$/,
      /^a: TKT-0381\s*DRL-04/,
      /^a: TKT-0360\s*VC-03/,
      /^a: Day report$/,
    ]);
  });
});

describe('Mine: the names the e2e specs find', () => {
  it('region "In progress" holds my working job and links it to its ticket', () => {
    const region = regions(mine(), 'aria-label="In progress"');
    expect(region).toHaveLength(1);
    expect(region[0]).toContain('href="/desk/t1"');
    expect(text(region[0]!)).toContain('TKT-0409');
  });

  it('"Day report" is a link to today’s PDF', () => {
    expect(mine()).toMatch(
      /<a\b[^>]*href="\/api\/v1\/reports\/day\.pdf\?date=2026-11-25"[^>]*>Day report<\/a>/,
    );
  });

  it('a failed download says so; otherwise nothing', () => {
    expect(text(mine({ dayReportFailed: true }))).toContain('Could not download the day report.');
    expect(text(mine())).not.toContain('Could not download');
  });
});

describe('Team keeps v1’s control order', () => {
  it('Working now, Waiting (kept), Not started, Cancelled, Closed with the Monthly totals h3', () => {
    expectOrder(team(), [
      /^h2: Working now$/,
      /^a: TKT-0409\s*LT-08\s*In progress\s*Tech A · Lead/,
      /^a: TKT-0414\s*CNC-02\s*In progress\s*Tech B · Lead/,
      /^a: TKT-0414\s*CNC-02\s*In progress\s*Tech A · Support/,
      /^a: TKT-0412\s*VC-03/,
      /^a: TKT-0395\s*VC-17\s*Paused · vendor_visit\s*Tech B · Lead/,
      /^a: TKT-0390\s*GRD-07\s*Paused · Spare part/,
      /^h2: Waiting$/,
      /^a: TKT-0395\s*VC-17/,
      /^a: TKT-0390\s*GRD-07/,
      /^h2: Not started$/,
      /^a: TKT-0415\s*Civil/,
      /^a: TKT-0413\s*HMC-11/,
      /^h2: Cancelled, last 24 hours$/,
      /^a: TKT-0370\s*DRL-04/,
      /^h2: Closed, last 30 days$/,
      /^a: TKT-0380\s*LT-08/,
      /^a: TKT-0381\s*DRL-04/,
      /^a: TKT-0360\s*VC-03/,
      /^h3: Monthly totals per person$/,
    ]);
  });
});

describe('Team: the names the e2e specs find', () => {
  it('each section is a region by its title', () => {
    const html = team();
    for (const name of [
      'Working now',
      'Waiting',
      'Not started',
      'Cancelled, last 24 hours',
      'Closed, last 30 days',
    ])
      expect(regions(html, `aria-label="${name}"`), name).toHaveLength(1);
  });

  it('"Working now" names the lead and links each job', () => {
    const region = text(regions(team(), 'aria-label="Working now"')[0] ?? '');
    expect(region).toContain('Tech A');
    expect(region).toContain('TKT-0409');
  });

  it('"Closed, last 30 days" links every closed job inside the window', () => {
    const region = regions(team(), 'aria-label="Closed, last 30 days"')[0] ?? '';
    for (const id of ['t30', 't33', 't31']) expect(region).toContain(`href="/desk/${id}"`);
    expect(region).not.toContain('href="/desk/t32"');
  });

  it('prints the takeaway once, as plain text outside every link', () => {
    const html = team();
    const line = teamModel(teamFixture, realT).takeaways['desk.team']!.text;
    expect(html.split(line).length - 1).toBe(1);
    for (const link of html.match(/<a\b[\s\S]*?<\/a>/g) ?? []) expect(link).not.toContain(line);
  });
});
