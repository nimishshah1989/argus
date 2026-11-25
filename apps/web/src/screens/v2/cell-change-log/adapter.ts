import type { FiguresReply } from '@uptimo/shared/analytics';
import { fill } from '../../../i18n/fill.js';
import type { Cell, TableModel } from '../../../ui/v2/domain/engine-table.js';
import { cellLogCsv, cellMoves, dayKey, type CellMove } from '../../analytics/machine-values.js';
import { kpiCard, sentence, verdictOf } from '../figures/point.js';
import { dayText, machineChip, sourceLine, type Translate } from '../figures/read.js';
import { commonWords, tableWords, type CommonWords } from '../figures/words.js';
import { tagOf, takeawayFor, type Item } from '../insight.js';
import type { Takeaways } from '../../../ui/v2/takeaway.js';
import type { CellLogModel, CellLogWords } from './model.js';

export type CellLogReader = {
  /** The machine's code, from the plant's list; null when the plant no longer lists it. */
  codeOf: (machineId: string) => string | null;
  role: string | undefined;
  /** The plant's today, for the export's file name. */
  today: string;
};

const ROLE_THAT_CORRECTS = new Set(['head', 'admin']);
const cellChip = (id: string, t: Translate) =>
  ({ kind: 'cell', id, label: fill(t('v2m.reg.cell'), { n: id }) }) as const;

/** "4 → 2" with each cell a chip when both are known; when one is not, the known one in words and a dash for the other ("— → Cell 2"). */
function changeCell(from: string | null, to: string | null, t: Translate): Cell {
  const none = t('analytics.value.none');
  if (from !== null && to !== null) {
    const text = `${from} → ${to}`;
    return { text, sort: text, chips: [cellChip(from, t), cellChip(to, t)], join: ' → ' };
  }
  const named = (id: string | null) => (id === null ? none : cellChip(id, t).label);
  const text = `${named(from)} → ${named(to)}`;
  return { text, sort: text };
}

/** The machine: a chip by its code, or a dash when the plant no longer lists it. A database id is never shown. */
function machineCell(code: string | null, t: Translate): Cell {
  return code === null
    ? { text: t('analytics.value.none'), sort: '' }
    : { text: code, sort: code, chip: machineChip(code) };
}

function rowOf(move: CellMove, code: string | null, canCorrect: boolean, t: Translate): Cell[] {
  const day = dayKey(move.date);
  const place =
    move.fromLocation !== null && move.fromLocation === move.toLocation
      ? t('analytics.cellLog.noChange')
      : `${move.fromLocation ?? t('analytics.value.none')} → ${move.toLocation ?? t('analytics.value.none')}`;
  return [
    { text: dayText(day), sort: day },
    machineCell(code, t),
    changeCell(move.fromCell, move.toCell, t),
    { text: place, sort: place },
    ...(canCorrect ? [{ text: t('analytics.cellLog.correct'), sort: '', action: move.id }] : []),
  ];
}

type Ctx = { c: CommonWords; t: Translate; source: string };

function tableOf(
  moves: CellMove[],
  code: (move: CellMove) => string | null,
  canCorrect: boolean,
  ctx: Ctx,
) {
  const { c, t } = ctx;
  const title = t('analytics.cellLog.title');
  const header = [
    t('analytics.cellLog.date'),
    t('analytics.cellLog.machine'),
    t('analytics.cellLog.cell'),
    t('analytics.cellLog.location'),
    ...(canCorrect ? [t('v2m.log.action')] : []),
  ];
  return {
    id: 'moves',
    title,
    header: header.map((label, at) => ({
      label,
      numeric: false,
      ...(canCorrect && at === header.length - 1 ? { fixed: true } : {}),
    })),
    rows: moves.map((move) => rowOf(move, code(move), canCorrect, t)),
    chips: [],
    words: tableWords(c, title, moves.length),
  } satisfies TableModel;
}

function csvOf(moves: CellMove[], reader: CellLogReader, t: Translate) {
  const labels = {
    docNo: t('analytics.cellLog.docNo'),
    title: t('analytics.cellLog.title'),
    date: t('analytics.cellLog.date'),
    machine: t('analytics.cellLog.machine'),
    fromCell: t('analytics.cellLog.fromCell'),
    toCell: t('analytics.cellLog.toCell'),
    fromLocation: t('analytics.cellLog.fromLocation'),
    toLocation: t('analytics.cellLog.toLocation'),
  };
  return {
    fileName: `cell-change-log-${reader.today}.csv`,
    text: cellLogCsv(moves, reader.codeOf, labels),
  };
}

function wordsOf(c: CommonWords, t: Translate, asOf: string): CellLogWords {
  const on = { date: dayText(asOf) };
  return {
    why: c.why,
    exportTitle: t('v2m.log.exportTitle'),
    exportSub: t('analytics.cellLog.docNo'),
    export: t('analytics.cellLog.export'),
    exported: t('v2m.log.exported'),
    correctSub: t('v2m.log.correctSub'),
    exportError: t('analytics.cellLog.exportError'),
    empty: t('analytics.cellLog.empty'),
    saved: t('analytics.cellLog.saved'),
    savedCopy: fill(t('v2m.savedCopy'), on),
    savedAfterCorrection: fill(t('v2m.savedAfterCorrection'), on),
    refused: t('analytics.cellLog.refused'),
    correct: {
      title: t('analytics.cellLog.correctTitle'),
      label: t('analytics.cellLog.correctDate'),
      save: t('analytics.cellLog.save'),
      cancel: t('v2m.cancel'),
    },
  };
}

function verdictFor(moves: CellMove[], code: (move: CellMove) => string | null, t: Translate) {
  const latest = moves[0];
  const headline = latest
    ? sentence(t('v2m.log.headline'), {
        moves: String(moves.length),
        machine: code(latest) ?? t('analytics.value.none'),
        day: dayText(dayKey(latest.date)),
      })
    : sentence(t('v2m.log.headlineNone'), {});
  return verdictOf(headline, t('analytics.cellLog.intro'), [t('analytics.cellLog.intro')]);
}

/** The calendar month before the as-of month: its `YYYY-MM` key and its name ("October 2026"). */
function priorMonthOf(asOf: string) {
  const first = new Date(`${asOf.slice(0, 7)}-01T00:00:00Z`);
  const before = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() - 1, 1));
  const period = new Intl.DateTimeFormat('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return { key: before.toISOString().slice(0, 7), period: period.format(before) };
}

/** Both cards name the month before as their yardstick (ADR 0035): the moves and the machines that moved in it. */
function kpisOf(moves: CellMove[], ctx: Ctx, prior: ReturnType<typeof priorMonthOf>) {
  const { t, source } = ctx;
  const machines = new Set(moves.map((move) => move.machineId)).size;
  const then = moves.filter((move) => dayKey(move.date).startsWith(prior.key));
  const yardstick = (value: number) =>
    fill(t('insight.yardstick.prior'), { period: prior.period, value: String(value) });
  return [
    {
      ...kpiCard(
        'moves',
        'cell',
        { label: t('v2m.log.kMoves'), value: String(moves.length), sub: t('v2m.log.kMovesSub') },
        source,
      ),
      yardstick: yardstick(then.length),
    },
    {
      ...kpiCard(
        'machines',
        'machines',
        { label: t('v2m.log.kMachines'), value: String(machines), sub: t('v2m.log.kMachinesSub') },
        source,
      ),
      yardstick: yardstick(new Set(then.map((move) => move.machineId)).size),
    },
  ];
}

/** Moves counted by the cell they went to; a move with no destination cell is left out. `name` is the table's cell text. */
function movesByCell(moves: CellMove[], t: Translate): Item[] {
  const counts = new Map<string, number>();
  for (const move of moves) {
    if (move.toCell !== null) counts.set(move.toCell, (counts.get(move.toCell) ?? 0) + 1);
  }
  return [...counts].map(([cell, count]) => ({
    name: cellChip(cell, t).label,
    value: count,
    shown: String(count),
  }));
}

/** One computed line over every move (ADR 0035, ticket 663). A move is not a loss, so the line is neutral. */
function takeawaysOf(moves: CellMove[], t: Translate): Takeaways {
  const line = takeawayFor(movesByCell(moves, t), { worse: 'high', additive: true }, t);
  return { moves: { ...line, tone: 'neutral', tag: tagOf('neutral', t) } };
}

/** The log screen from the engine's `cell-change-log` figure; null while the engine has not computed it. */
export function cellLogModel(
  reply: FiguresReply,
  t: Translate,
  reader: CellLogReader,
): CellLogModel | null {
  const figure = reply.figures.find((candidate) => candidate.key === 'cell-change-log');
  if (figure?.status !== 'ready') return null;
  const c = commonWords(t);
  const ctx = { c, t, source: sourceLine(c.source, reply.asOf) };
  const moves = cellMoves(figure.value);
  const code = (move: CellMove) => reader.codeOf(move.machineId);
  const canCorrect = ROLE_THAT_CORRECTS.has(reader.role ?? '');
  return {
    verdict: verdictFor(moves, code, t),
    takeaways: takeawaysOf(moves, t),
    kpis: kpisOf(moves, ctx, priorMonthOf(reply.asOf)),
    table: tableOf(moves, code, canCorrect, ctx),
    moves: moves.map((move) => ({
      id: move.id,
      machineId: move.machineId,
      code: code(move) ?? t('analytics.value.none'),
      day: dayKey(move.date),
      change: `${move.fromCell ?? ''} → ${move.toCell ?? ''}`,
    })),
    canCorrect,
    csv: csvOf(moves, reader, t),
    source: ctx.source,
    words: wordsOf(c, t, reply.asOf),
  };
}
