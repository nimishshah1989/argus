import type { Point } from '../../../ui/v2/points.js';
import type { VerdictData } from '../../../ui/v2/verdict.js';
import type { KpiData } from '../../../ui/v2/kpi-card.js';
import type { IconName } from '../../../ui/v2/icons.js';
import type { Drill } from '../../../ui/v2/drill.js';
import type { RegisterKpi } from './read.js';

/** A sentence with `{name}` gaps as segments: the gaps are the engine's printed figures, in strong type. */
export function sentence(template: string, values: Record<string, string>): Point {
  return template
    .split(/(\{\w+\})/)
    .filter((part) => part !== '')
    .map((part) => {
      const name = /^\{(\w+)\}$/.exec(part)?.[1];
      return name !== undefined && Object.hasOwn(values, name)
        ? { text: values[name] ?? '', tone: 'strong' as const }
        : { text: part };
    });
}

export const plainPoint = (text: string): Point => [{ text }];

/** The answer first: a headline, the line under it, and the Guide's words behind the Why. */
export const verdictOf = (headline: Point, context: string, why: string[]): VerdictData => ({
  headline,
  context,
  why: why.map(plainPoint),
});

/** A figure the engine printed as a KPI card: its value and its own sub-line as the meaning, no change claimed. */
export function kpiCard(id: string, icon: IconName, kpi: RegisterKpi, more: string): KpiData {
  return {
    id,
    label: kpi.label,
    icon,
    value: kpi.value,
    delta: { text: '', up: false, good: true, flat: true },
    period: '',
    meaning: kpi.sub ?? '',
    more,
  };
}

/** The card with the control that opens the rows behind it, when the figure has any. */
export const withDrill = (card: KpiData, drill: Drill | undefined): KpiData =>
  drill ? { ...card, drill } : card;
