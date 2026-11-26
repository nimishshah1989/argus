// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { en } from '@uptimo/shared/i18n';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { fill } from '../../../i18n/fill.js';
import oem from '../../../../../../fixtures/answer-key/oem-analytics.json' with { type: 'json' };
import { printed, realReply } from '../figures/real-reply.js';
import type { Translate } from '../figures/read.js';
import { oemModel } from './adapter.js';

const t: Translate = (key, values) =>
  fill((en as Record<string, string>)[key] ?? key, values ?? {});
const platform: FiguresReply = {
  ...realReply(),
  figures: [
    {
      key: 'oem-analytics',
      screen: 'oem-analytics',
      owner: 36,
      status: 'ready',
      value: oem,
      drill: { type: 'machine', ids: [] },
    },
  ],
};

describe('OEM analytics', () => {
  it('draws from the engine’s own reply now the engine computes it (#814)', () => {
    expect(oemModel(realReply(), t, { mayDecide: false })).not.toBeNull();
  });

  it('prints every figure of the platform’s own OEM page, each machine as a chip', () => {
    const model = oemModel(platform, t, { mayDecide: false })!;
    const shown = new Set(printed(model));
    for (const kpi of oem.pages[0]!.kpis) expect(shown, kpi.label).toContain(kpi.label);
    const machines = model.tables.find((table) => table.title === 'Machines')!;
    expect(machines.rows).toHaveLength(24);
    expect(machines.rows[0]?.[0]?.chip).toMatchObject({ kind: 'machine', id: 'TMC-6' });
    const repeats = model.tables.find((table) => table.title.startsWith('Faults that repeat'))!;
    const which = repeats.rows.at(-1)!.find((cell) => cell.chips);
    expect(which?.chips?.map((chip) => chip.id)).toEqual(['VC-44', 'VC-49']);
  });

  it('opens with how many young machines broke down and how much of it looks like the maker’s', () => {
    const model = oemModel(platform, t, { mayDecide: false })!;
    expect(model.verdict.headline.map((seg) => seg.text).join('')).toContain(
      '24 machines under 300 days old have had 72 breakdowns; 33.3 hrs of the downtime',
    );
  });

  it('prints no rupee for anyone, even where the platform’s page had one (ADR 0051)', () => {
    const shown = printed(oemModel(platform, t, { mayDecide: true })).join(' ');
    expect(shown).not.toContain('₹');
    expect(shown).toContain('56% of the hours');
  });

  it('leaves out the cause drop-down, which holds nothing stored, and says nothing of it as a figure', () => {
    const model = oemModel(platform, t, { mayDecide: false })!;
    const every = model.tables.find((table) => table.title.startsWith('Every breakdown'))!;
    expect(every.header.map((h) => h.label)).not.toContain('Cause');
  });
});
