import type { FiguresReply } from '@uptimo/shared/analytics';
import { kpiCard, sentence, verdictOf } from '../figures/point.js';
import {
  machineChip,
  pagesOf,
  sourceLine,
  withoutMoney,
  type RegisterTable,
  type Translate,
} from '../figures/read.js';
import { NOT_A_FIGURE, engineTable, type Cell, type TableModel } from '../figures/table.js';
import { commonWords, tableWords, type CommonWords } from '../figures/words.js';
import type { OemModel } from './model.js';

/** The prototype's decision column holds a drop-down; the engine has nothing stored to print there yet. */
const CAUSE_PICKER = 'Cause';

const machine = (cell: string): Cell => ({ text: cell, sort: cell, chip: machineChip(cell) });
const machines = (cell: string): Cell => {
  const codes = cell.split(/,\s*/).filter((code) => code !== '');
  return { text: cell, sort: cell, chips: codes.map((code) => machineChip(code)) };
};

/**
 * One row's Cause cell in "Every breakdown on a young machine: decide the cause" (ADR 0051): the cause's label as text,
 * sorted by it; a reader who may decide gets `action: 'cause:<ticketId>'` (EngineTable draws it as a button that opens
 * the picker). No ticket id for the row, or a reader who may not decide: plain text, no action.
 */
export function causeCell(label: string, ticketId: string | undefined, mayDecide: boolean): Cell {
  void [label, ticketId, mayDecide];
  throw new Error('not implemented');
}

function tableOf(table: RegisterTable, c: CommonWords): TableModel {
  const title = table.title ?? '';
  return engineTable(table, {
    id: title,
    title,
    words: tableWords(c, title, table.rows.length),
    skip: (label) => NOT_A_FIGURE(label) || label === CAUSE_PICKER,
    chip: { Machine: machine, 'Which machines': machines },
    ...(table.header.includes('Main cause') ? { chipColumn: 'Main cause' } : {}),
  });
}

/** The OEM screen from the engine's `oem-analytics` figure; null while the engine has not computed it. The figure carries no rupee (ADR 0051); `mayDecide` is drawn by ticket 815. */
export function oemModel(
  reply: FiguresReply,
  t: Translate,
  _reader: { mayDecide: boolean },
): OemModel | null {
  const page = pagesOf(reply, 'oem-analytics')?.[0];
  if (!page) return null;
  const c = commonWords(t);
  const source = sourceLine(c.source, reply.asOf);
  const kpis = page.kpis.map((kpi) => ({
    ...kpi,
    sub: kpi.sub === null ? kpi.sub : withoutMoney(kpi.sub),
  }));
  const [young, breakdowns, , oem] = kpis;
  const headline =
    young && breakdowns && oem
      ? sentence(t('v2m.oem.headline'), {
          young: young.value,
          breakdowns: breakdowns.value,
          oem: oem.value,
        })
      : sentence(t('v2m.oem.headlineFew'), { young: young?.value ?? c.none });
  return {
    verdict: verdictOf(headline, breakdowns?.sub ?? young?.sub ?? '', [t('v2m.oem.why')]),
    kpis: kpis.map((kpi, i) => kpiCard(`oem-${i}`, i === 0 ? 'machines' : 'wrench', kpi, source)),
    tables: page.tables.map((table) => tableOf(table, c)),
    source,
    words: { why: c.why },
  };
}
