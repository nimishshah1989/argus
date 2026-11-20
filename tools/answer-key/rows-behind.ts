/**
 * Writes `apps/web/src/gallery/rows-behind/generated/replies.json`: the drill replies the v2 rows-behind panel is shown and tested
 * with. They are what `GET /analytics/drill` answers, built as the server builds them (`drillRows` in
 * `apps/server/src/modules/analytics/routes.ts`) from the real engine run over the answer key. No row is written by hand.
 * Run `pnpm tsx tools/answer-key/rows-behind.ts` after the engine's figures change.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { DEFAULT_PROFILE } from '../../packages/shared/src/index.js';
import { drillReplySchema, type DrillReply } from '../../packages/shared/src/analytics.js';
import { runWith } from '../../packages/domain/src/index.js';
import { COMPUTERS } from '../../packages/domain/src/analytics/computers.js';
import { ENGINE_DATA } from '../../packages/domain/test/answer-key/fixture.js';

const AS_OF = '2026-11-11';
const FIGURES = [
  'dashboard.pm-hours',
  'dashboard.breakdown-free',
  'dashboard.process-machines',
  'dashboard.conventional-machines',
  'dashboard.dg-sets',
  'cell-change-log',
];
const OUT = new URL(
  '../../apps/web/src/gallery/rows-behind/generated/replies.json',
  import.meta.url,
);

type Row = Record<string, unknown>;

/** The workbook's ids are its own codes; the reply names UUIDs, so each id becomes the same UUID every run. */
function uuid(id: string): string {
  const h = createHash('sha1').update(id).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
const codes: Record<string, string> = {};
const machine = (code: string): string => ((codes[uuid(code)] = code), uuid(code));
const without = (row: object, ...keys: string[]): Row =>
  Object.fromEntries(Object.entries(row).filter(([key]) => !keys.includes(key)));

/** The rows of one drill type, shaped as the reply contract names them (the server's `drillRows`). */
function rowsOf(type: string): Row[] {
  if (type === 'machine')
    return ENGINE_DATA.machines.map((m) => ({
      ...m,
      serial: m.serial ?? null,
      controllerModel: m.controllerModel ?? null,
      controllerSerial: m.controllerSerial ?? null,
    }));
  if (type === 'move')
    return ENGINE_DATA.moves.map((m) => ({
      ...m,
      fromLocation: m.fromLocation ?? null,
      toLocation: m.toLocation ?? null,
    }));
  const tasks = ENGINE_DATA.tasks.map((t) => without(t, 'parentId', 'reason', 'expectedOn'));
  return [...ENGINE_DATA.tickets, ...tasks].map((t) => without(t, 'raisedChannel', 'scheduledOn'));
}

/** A row with its own id and the machine it names as UUIDs; the code each machine UUID stands for is kept for the table. */
function withUuids(row: Row, type: string): Row {
  const own = type === 'machine' ? machine(row.id as string) : uuid(row.id as string);
  const out: Row = { ...row, id: own };
  if (type === 'machine') return out;
  if (typeof row.machineId === 'string') out.machineId = machine(row.machineId);
  return out;
}

const result = runWith(COMPUTERS, { data: ENGINE_DATA, asOf: AS_OF, profile: DEFAULT_PROFILE });
const figures = FIGURES.map((key) => {
  const figure = result.figures.find((f) => f.key === key);
  if (!figure || figure.status !== 'ready') throw new Error(`${key} is not a ready figure`);
  const byId = new Map(rowsOf(figure.drill.type).map((row) => [row.id as string, row]));
  const found = figure.drill.ids.flatMap((id) => {
    const row = byId.get(id);
    return row ? [row] : [];
  });
  const rows = found.map((row) => withUuids(row, figure.drill.type));
  const reply: DrillReply = drillReplySchema.parse({ type: figure.drill.type, rows });
  const body = reply.rows.map((row) => `    ${JSON.stringify(row)}`).join(',\n');
  return `  ${JSON.stringify(key)}: {"value":${JSON.stringify(figure.value)},"reply":{"type":"${reply.type}","rows":[\n${body}\n  ]}}`;
});

/** One figure per block and one row per line, so a change to the engine shows as a readable diff. */
mkdirSync(new URL('.', OUT), { recursive: true });
writeFileSync(
  OUT,
  `{\n"asOf":${JSON.stringify(AS_OF)},\n"machineCodes":${JSON.stringify(codes)},\n"figures":{\n${figures.join(',\n')}\n}}\n`,
);
console.log(`wrote ${FIGURES.length} replies`);
