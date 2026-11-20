import { drillReplySchema } from '@uptimo/shared/analytics';
import { catalogue } from '../figures/live.js';
import replies from '../../../gallery/rows-behind/generated/replies.json' with { type: 'json' };
import { rowsModel } from './model.js';

type Entry = { value: unknown; reply: unknown };
const figures = replies.figures as Record<string, Entry>;
const codes = replies.machineCodes as Record<string, string>;

/** The gallery's rows: the real drill replies the engine gave for the frozen 11 November plant, through the live adapter. */
export function frozenRows(figure: string) {
  const entry = figures[figure];
  if (!entry) return Promise.resolve(null);
  return Promise.resolve(
    rowsModel(
      {
        key: figure,
        value: entry.value,
        reply: drillReplySchema.parse(entry.reply),
        asOf: replies.asOf,
        machineCode: (id) => codes[id],
      },
      catalogue,
    ),
  );
}
