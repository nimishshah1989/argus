// @vitest-environment node
import { en } from '@uptimo/shared/i18n';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { Navigate } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { fill } from '../../../../i18n/fill.js';
import oem from '../../../../../../../fixtures/answer-key/oem-analytics.json' with { type: 'json' };
import { printed, realReply } from '../../figures/real-reply.js';
import type { Translate } from '../../figures/read.js';
import { liveScreen } from '../../live.js';
import { oemModel } from '../adapter.js';

const t: Translate = (key, values) =>
  fill((en as Record<string, string>)[key] ?? key, values ?? {});
const reply: FiguresReply = {
  ...realReply(),
  figures: [
    {
      key: 'oem-analytics',
      screen: 'oem-analytics',
      owner: 812,
      status: 'ready',
      value: oem,
      drill: { type: 'ticket', ids: [] },
    },
  ],
};

describe('S18 OEM live: edges', () => {
  it('never falls back to a v1 page or to the register', () => {
    const drawn = liveScreen('machines', 'oem-analytics');
    expect(drawn?.type).not.toBe(Navigate);
  });

  it('no rupee for any reader, in any KPI sub or table cell', () => {
    for (const mayDecide of [true, false]) {
      const shown = printed(oemModel(reply, t, { mayDecide })).join(' ');
      expect(shown, String(mayDecide)).not.toMatch(/₹|lakh|to claim/);
    }
  });

  it('a KPI whose whole sub-line was money keeps its card, with no sub-line', () => {
    const model = oemModel(reply, t, { mayDecide: false })!;
    expect(model.kpis).toHaveLength(6);
    expect(printed(model).join(' ')).not.toContain('of lost output');
  });
});
