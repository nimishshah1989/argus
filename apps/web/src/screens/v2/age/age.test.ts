// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { en } from '@uptimo/shared/i18n';
import { fill } from '../../../i18n/fill.js';
import { registerPages } from '../../analytics/machine-values.js';
import { printed, realReply } from '../figures/real-reply.js';
import type { Translate } from '../figures/read.js';
import { ageModel } from './adapter.js';

const t: Translate = (key, values) =>
  fill((en as Record<string, string>)[key] ?? key, values ?? {});
const reply = realReply();
const model = ageModel(reply, t)!;
const kpis = registerPages(reply.figures.find((f) => f.key === 'a8-age')?.value)[0]!.kpis;

describe('the age analysis, from the engine’s own reply', () => {
  it('prints all ten figures of the reply: five band totals and five averages per machine', () => {
    expect(kpis).toHaveLength(10);
    const shown = new Set(printed(model));
    for (const kpi of kpis) {
      expect(shown, kpi.label).toContain(kpi.label);
      expect(shown, kpi.value).toContain(kpi.value);
      expect(shown, kpi.sub ?? '').toContain(kpi.sub ?? '');
    }
  });

  it('puts each band’s total and average on one row, in the engine’s order', () => {
    expect(model.bands.rows.map((row) => row[0]?.text)).toEqual([
      '0-5 yrs',
      '5-10 yrs',
      '10-15 yrs',
      '15-20 yrs',
      '20+ yrs',
    ]);
    expect(model.bands.rows[4]?.map((cell) => cell.text)).toEqual([
      '20+ yrs',
      '418.7 hrs',
      '4 machines, 125 breakdowns',
      '104.66 hrs',
      '418.7 hrs ÷ 4 machines',
    ]);
  });

  it('opens with the band that loses the most hours per machine, against the youngest', () => {
    const headline = model.verdict.headline.map((seg) => seg.text).join('');
    expect(headline).toBe(
      'Machines aged 20+ yrs lose the most: 104.66 hrs of breakdown each, against 14.76 hrs for those aged 0-5 yrs.',
    );
  });

  it('claims no change against an earlier period, which the engine does not hold', () => {
    expect(model.kpis.every((kpi) => kpi.delta.text === '')).toBe(true);
  });

  it('says the engine has not computed the age analysis, or sent only half of it', () => {
    const half = {
      ...reply,
      figures: reply.figures.map((f) =>
        f.key === 'a8-age'
          ? {
              ...f,
              value: { pages: [{ page: 'a8', title: 'x', kpis: kpis.slice(0, 5), tables: [] }] },
            }
          : f,
      ),
    };
    expect(ageModel(half, t)).toBeNull();
  });
});
