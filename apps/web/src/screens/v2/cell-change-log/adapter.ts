import type { FiguresReply } from '@uptimo/shared/analytics';
import { fill } from '../../../i18n/fill.js';
import type { Cell, TableModel } from '../../../ui/v2/domain/engine-table.js';
import { cellLogCsv, cellMoves, dayKey, type CellMove } from '../../analytics/machine-values.js';
import { kpiCard, sentence, verdictOf } from '../figures/point.js';
import { dayText, machineChip, sourceLine, type Translate } from '../figures/read.js';
import { commonWords, tableWords, type CommonWords } from '../figures/words.js';
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

/** "4 → 2" with each cell a chip when both are known; the printed arrow in words when one is not. */
function changeCell(from: string | null, to: string | null, t: Translate): Cell {
  const none = t('analytics.value.none');
  const text = `${from ?? none} → ${to ?? none}`;
  return from !== null && to !== null
    ? { text, sort: text, chips: [cellChip(from, t), cellChip(to, t)], join: ' → ' }
    : { text, sort: text };
}

function rowOf(move: CellMove, code: string, canCorrect: boolean, t: Translate): Cell[] {
  const day = dayKey(move.date);
  const place =
    move.fromLocation !== null && move.fromLocation === move.toLocation
      ? t('analytics.cellLog.noChange')
      : `${move.fromLocation ?? t('analytics.value.none')} → ${move.toLocation ?? t('analytics.value.none')}`;
  return [
    { text: dayText(day), sort: day },
    { text: code, sort: code, chip: machineChip(code) },
    changeCell(move.fromCell, move.toCell, t),
    { text: place, sort: place },
    ...(canCorrect ? [{ text: t('analytics.cellLog.correct'), sort: '', action: move.id }] : []),
  ];
}

type Ctx = { c: CommonWords; t: Translate; source: string };

function tableOf(
  moves: CellMove[],
  code: (move: CellMove) => string,
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

function wordsOf(c: CommonWords, t: Translate): CellLogWords {
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
    refused: t('analytics.cellLog.refused'),
    correct: {
      title: t('analytics.cellLog.correctTitle'),
      label: t('analytics.cellLog.correctDate'),
      save: t('analytics.cellLog.save'),
      cancel: t('v2m.cancel'),
    },
  };
}

function verdictFor(moves: CellMove[], code: (move: CellMove) => string, t: Translate) {
  const latest = moves[0];
  const headline = latest
    ? sentence(t('v2m.log.headline'), {
        moves: String(moves.length),
        machine: code(latest),
        day: dayText(dayKey(latest.date)),
      })
    : sentence(t('v2m.log.headlineNone'), {});
  return verdictOf(headline, t('analytics.cellLog.intro'), [t('analytics.cellLog.intro')]);
}

function kpisOf(moves: CellMove[], ctx: Ctx) {
  const { t, source } = ctx;
  const machines = new Set(moves.map((move) => move.machineId)).size;
  return [
    kpiCard(
      'moves',
      'cell',
      { label: t('v2m.log.kMoves'), value: String(moves.length), sub: t('v2m.log.kMovesSub') },
      source,
    ),
    kpiCard(
      'machines',
      'machines',
      { label: t('v2m.log.kMachines'), value: String(machines), sub: t('v2m.log.kMachinesSub') },
      source,
    ),
  ];
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
  const code = (move: CellMove) => reader.codeOf(move.machineId) ?? move.machineId;
  const canCorrect = ROLE_THAT_CORRECTS.has(reader.role ?? '');
  return {
    verdict: verdictFor(moves, code, t),
    kpis: kpisOf(moves, ctx),
    table: tableOf(moves, code, canCorrect, ctx),
    moves: moves.map((move) => ({
      id: move.id,
      machineId: move.machineId,
      code: code(move),
      day: dayKey(move.date),
      change: `${move.fromCell ?? ''} → ${move.toCell ?? ''}`,
    })),
    canCorrect,
    csv: csvOf(moves, reader, t),
    source: ctx.source,
    words: wordsOf(c, t),
  };
}
