import type { FiguresReply } from '@uptimo/shared/analytics';
import oem from '../../../../../../fixtures/answer-key/oem-analytics.json' with { type: 'json' };
import { realReply } from '../figures/real-reply.js';

export const BREAKDOWNS = 'Every breakdown on a young machine: decide the cause';

/**
 * The platform's OEM page reshaped the way the engine prints it after #812 (ADR 0051): the breakdown table's Cause is
 * the label a person decided (row 0 decided "OEM / build defect", the rest "Not decided"), with one ticket id per row
 * (`rowTicketIds`), and no ticket id for the last row (a row the engine could not name).
 */
export function causeReply(): FiguresReply {
  const page = structuredClone(oem.pages[0]!);
  const tables = page.tables.map((table) => {
    if (table.title !== BREAKDOWNS) return table;
    const at = table.header.indexOf('Cause');
    const rows = table.rows.map((row, i) =>
      row.map((cell, c) => (c !== at ? cell : i === 0 ? 'OEM / build defect' : 'Not decided')),
    );
    const rowTicketIds = rows.map((_, i) => (i === rows.length - 1 ? '' : `ticket-${i}`));
    return { ...table, rows, rowTicketIds };
  });
  return {
    ...realReply(),
    figures: [
      {
        key: 'oem-analytics',
        screen: 'oem-analytics',
        owner: 812,
        status: 'ready',
        value: { pages: [{ ...page, tables }] },
        drill: { type: 'ticket', ids: [] },
      },
    ],
  };
}
