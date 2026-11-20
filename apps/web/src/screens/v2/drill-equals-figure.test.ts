// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { en } from '@uptimo/shared/i18n';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { fill } from '../../i18n/fill.js';
import type { KpiData } from '../../ui/v2/kpi-card.js';
import { ageModel } from './age/adapter.js';
import { fixFinderModel } from './fix-finder/adapter.js';
import type { Translate } from './figures/read.js';
import { realReply } from './figures/real-reply.js';
import { footprintModel } from './footprint/adapter.js';
import { registersModel } from './machines-register/adapter.js';
import { problemAnalysisModel } from './problem-analysis/adapter.js';
import type { TFunction } from 'i18next';

const t: Translate = (key, values) =>
  fill((en as Record<string, string>)[key] ?? key, values ?? {});
const tf = ((key: string) => (en as Record<string, string>)[key] ?? key) as TFunction;
const reply: FiguresReply = realReply();
const rowsOf = (key: string): number =>
  reply.figures.find((figure) => figure.key === key)?.drill.ids.length ?? -1;
const number = (text: string): number => Number(text.replace(/,/g, ''));
const withDrill = (cards: readonly { drill?: unknown }[]) => cards.filter((card) => card.drill);

/** The rule: a count that opens rows opens exactly that many; a card that is not that count opens none. */
describe('a card that opens the rows behind it, over the real engine', () => {
  it('Footprint: the machines-mapped card opens as many machines as it counts', () => {
    const cards = withDrill(footprintModel(reply, t)!.kpis) as KpiData[];
    expect(cards.map((kpi) => number(kpi.value.split('/')[0]!))).toEqual([rowsOf('a7-footprint')]);
  });

  it('Fix Finder: the similar-cases card opens as many tickets as it counts', () => {
    const cards = withDrill(fixFinderModel(reply, tf)!.figures) as { value: string }[];
    expect(cards.map((kpi) => number(kpi.value))).toEqual([rowsOf('fix-finder')]);
  });

  it('Problem Analysis: the breakdowns-studied card opens as many tickets as it counts', () => {
    const model = problemAnalysisModel(reply, tf)!;
    const cards = withDrill([...model.studied, ...model.whatIf]) as { value: string }[];
    expect(cards.map((kpi) => number(kpi.value))).toEqual([rowsOf('a10-problems')]);
  });

  it('Machines register: no per-type count opens the whole register; one page control does', () => {
    const model = registersModel(reply, t)!;
    const whole = rowsOf('registers');
    expect(whole).toBeGreaterThan(0);
    for (const page of model.pages)
      for (const kpi of withDrill(page.kpis) as KpiData[])
        expect(number(kpi.value), `${page.id} ${kpi.label}`).toBe(whole);
    expect(model.drill).toMatchObject({ figure: 'registers' });
  });

  it('Age: no band card opens all the machines; one page control does', () => {
    const model = ageModel(reply, t)!;
    expect(withDrill(model.kpis)).toEqual([]);
    expect(model.drill).toMatchObject({ figure: 'a8-age' });
    expect(rowsOf('a8-age')).toBeGreaterThan(0);
  });
});
