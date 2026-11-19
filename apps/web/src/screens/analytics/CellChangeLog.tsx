import { useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { correctMove, getConfig, getMe } from '../../api.js';
import { ApiError } from '../../data/index.js';
import { FormSheet } from '../../patterns/form-sheet.js';
import { Button } from '../../ui/button.js';
import { Download } from '../../ui/icon.js';
import { DataTable, EmptyState, tableView, type Column } from '../../ui/elements/index.js';
import {
  cellLogCsv,
  cellMoves,
  correctionError,
  displayDay,
  type CellLogLabels,
  type CellMove,
} from './machine-values.js';
import { Template } from './shell/patterns/template.js';

type Figure = FiguresReply['figures'][number];

const REGISTER = 'register' as const;

function labelsOf(t: (key: string) => string): CellLogLabels {
  return {
    docNo: t('analytics.cellLog.docNo'),
    title: t('analytics.cellLog.title'),
    date: t('analytics.cellLog.date'),
    machine: t('analytics.cellLog.machine'),
    fromCell: t('analytics.cellLog.fromCell'),
    toCell: t('analytics.cellLog.toCell'),
    fromLocation: t('analytics.cellLog.fromLocation'),
    toLocation: t('analytics.cellLog.toLocation'),
  };
}

/** The CSV download the platform's controlled form produces: DOC. NO. above the table, one row per move. */
function download(
  moves: readonly CellMove[],
  codeOf: (id: string) => string | null,
  labels: CellLogLabels,
) {
  const blob = new Blob([cellLogCsv(moves, codeOf, labels)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `cell-change-log-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function ExportButton({
  moves,
  codeOf,
  disabled,
}: {
  moves: readonly CellMove[];
  codeOf: (id: string) => string | null;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        // eslint-disable-next-line i18next/no-literal-string -- prop value, not copy
        variant="secondary"
        onClick={() => {
          setFailed(false);
          try {
            download(moves, codeOf, labelsOf(t));
          } catch {
            setFailed(true);
          }
        }}
        disabled={disabled}
      >
        <span className="inline-flex items-center gap-2">
          <Download aria-hidden size={18} />
          {t('analytics.cellLog.export')}
        </span>
      </Button>
      {failed ? (
        <p role="alert" className="text-footnote font-medium text-danger-ink">
          {t('analytics.cellLog.exportError')}
        </p>
      ) : null}
    </div>
  );
}

function Change({
  from,
  to,
  absent,
  noChange,
}: {
  from: string | null;
  to: string | null;
  absent: string;
  noChange?: string;
}) {
  if (noChange && from !== null && from === to) return <span>{noChange}</span>;
  return (
    <span className="tabular-nums">
      {from ?? absent} → {to ?? absent}
    </span>
  );
}

/**
 * The correction sheet: one date, prefilled from the move's ISO day. A 422 that names the field puts the
 * server's words on the form; any other refusal shows the catalogue's line. The sheet stays open on refusal.
 */
function CorrectSheet({
  move,
  onClose,
  onSaved,
}: {
  move: CellMove;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function save(values: Record<string, string>): Promise<boolean> {
    setPending(true);
    setError(null);
    try {
      await correctMove(move.machineId, move.id, values.date ?? '');
    } catch (caught) {
      const named = caught instanceof ApiError ? correctionError(caught).date : undefined;
      setError(named ?? t('analytics.cellLog.refused'));
      return false;
    } finally {
      setPending(false);
    }
    // The row and every figure come back from the server; the screen never changes a date itself.
    await client.invalidateQueries({ queryKey: ['analytics-figures'] });
    onSaved();
    return true;
  }

  return (
    <FormSheet
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t('analytics.cellLog.correctTitle')}
      submitLabel={t('analytics.cellLog.save')}
      fields={[
        // eslint-disable-next-line i18next/no-literal-string -- field config, not copy
        { name: 'date', label: t('analytics.cellLog.correctDate'), required: true, kind: 'date' },
      ]}
      initial={{ date: move.date }}
      offlineAllowed={false}
      pending={pending}
      error={error}
      onSubmit={save}
    />
  );
}

/** One row's way into the correction sheet; the table mounts it only for head and admin. */
function CorrectCell({ move, onSaved }: { move: CellMove; onSaved: () => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        // eslint-disable-next-line i18next/no-literal-string -- prop value, not copy
        variant="secondary"
        onClick={() => setOpen(true)}
      >
        {t('analytics.cellLog.correct')}
      </Button>
      {open ? <CorrectSheet move={move} onClose={() => setOpen(false)} onSaved={onSaved} /> : null}
    </>
  );
}

/** At most this many moves paint at once; the pager appears only when there are more. */
const PAGE_SIZE = 50;
const LINK = 'inline-flex min-h-target-min items-center font-semibold text-accent-text';

/** The columns: date, machine (a link to its page), the cell and location change, and the head's correction. */
function columnsOf(
  t: TFunction,
  codeOf: (id: string) => string | null,
  onSaved: (() => void) | null,
): Column<CellMove>[] {
  const absent = t('analytics.value.none');
  return [
    {
      id: 'date',
      header: t('analytics.cellLog.date'),
      cell: (move) => <span className="tabular-nums">{displayDay(move.date)}</span>,
    },
    {
      id: 'machine',
      header: t('analytics.cellLog.machine'),
      cell: (move) => (
        <Link to={`/analytics/machines/${move.machineId}`} className={LINK}>
          {codeOf(move.machineId) ?? absent}
        </Link>
      ),
    },
    {
      id: 'cell',
      header: t('analytics.cellLog.cell'),
      cell: (move) => <Change from={move.fromCell} to={move.toCell} absent={absent} />,
    },
    {
      id: 'location',
      header: t('analytics.cellLog.location'),
      cell: (move) => (
        <Change
          from={move.fromLocation}
          to={move.toLocation}
          absent={absent}
          noChange={t('analytics.cellLog.noChange')}
        />
      ),
    },
    ...(onSaved
      ? [
          {
            id: 'correct',
            header: t('analytics.cellLog.correct'),
            cell: (move: CellMove) => <CorrectCell move={move} onSaved={onSaved} />,
          },
        ]
      : []),
  ];
}

/** The moves table: date, machine (a link to its page), cell and location change, and the head's correction. */
function CellLogTable({
  moves,
  codeOf,
  canCorrect,
  onSaved,
}: {
  moves: readonly CellMove[];
  codeOf: (id: string) => string | null;
  canCorrect: boolean;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [page, setPage] = useState(0);
  const columns = columnsOf(t, codeOf, canCorrect ? onSaved : null);
  const view = tableView([...moves], columns, { filter: '', page, pageSize: PAGE_SIZE }, () => '');
  return (
    <DataTable
      columns={columns}
      rows={view.rows}
      rowKey={(move) => move.id}
      total={view.total}
      page={view.page}
      pageSize={PAGE_SIZE}
      labels={{
        caption: t('analytics.cellLog.title'),
        filter: t('analytics.cellLog.title'),
        previous: t('analytics.keytable.previous'),
        next: t('analytics.keytable.next'),
        page: (current, pages) => t('analytics.keytable.page', { page: current, pages }),
        range: (from, to, total) =>
          t('analytics.keytable.range', {
            from: from.toLocaleString('en-IN'),
            to: to.toLocaleString('en-IN'),
            total: total.toLocaleString('en-IN'),
          }),
        empty: t('analytics.keytable.empty'),
      }}
      onSort={() => undefined}
      onPage={setPage}
      hidePagerWhenFits
    />
  );
}

/**
 * The cell change log (39b) on the register template: every move the engine recorded, latest first, with its machine,
 * cell and location change. The export carries the platform's controlled document number. A not-computed engine shows
 * the honest "Not computed yet" and offers no export.
 */
export function CellChangeLog({
  figure,
  menu,
  asOf,
}: {
  figure: Figure | undefined;
  menu: ReactNode;
  asOf: string;
}) {
  const { t } = useTranslation();
  const config = useQuery({ queryKey: ['config'], queryFn: getConfig });
  const role = useQuery({ queryKey: ['me'], queryFn: getMe }).data?.user.role;
  const [saved, setSaved] = useState(false);
  const ready = figure?.status === 'ready';
  const moves = cellMoves(figure?.value);
  const codeOf = (id: string) =>
    config.data?.machines.find((machine) => machine.id === id)?.code ?? null;
  const exportable = ready && moves.length > 0;
  // The server's settings gate allows exactly these two roles; the plant head is not one of them.
  const canCorrect = role === 'head' || role === 'admin';
  return (
    <Template
      kind={REGISTER}
      trail={menu}
      title={t('analytics.screen.cell-change-log')}
      lede={`${t('analytics.asOf', { date: asOf })} · ${t('analytics.cellLog.intro')}`}
      actions={<ExportButton moves={moves} codeOf={codeOf} disabled={!exportable} />}
      main={
        <>
          {saved ? (
            <p role="status" className="text-footnote font-medium text-ok-ink">
              {t('analytics.cellLog.saved')}
            </p>
          ) : null}
          {!ready ? (
            <div data-cell-log="not-computed">
              <EmptyState title={t('analytics.notComputed')} />
            </div>
          ) : moves.length === 0 ? (
            <EmptyState title={t('analytics.cellLog.empty')} />
          ) : (
            <CellLogTable
              moves={moves}
              codeOf={codeOf}
              canCorrect={canCorrect}
              onSaved={() => setSaved(true)}
            />
          )}
        </>
      }
    />
  );
}
