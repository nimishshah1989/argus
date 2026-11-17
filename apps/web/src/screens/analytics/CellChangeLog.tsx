import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { getConfig } from '../../api.js';
import { Button } from '../../ui/button.js';
import { Download } from '../../ui/icon.js';
import { Stack } from '../../ui/layout.js';
import {
  cellLogCsv,
  cellMoves,
  displayDay,
  type CellLogLabels,
  type CellMove,
} from './machine-values.js';

type Figure = FiguresReply['figures'][number];

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

function HeadCell({ children }: { children: string }) {
  return (
    <th scope="col" className="p-2 font-medium text-neutral-600">
      {children}
    </th>
  );
}

/** The moves table: date, machine (a link to its page), cell change and location change. */
function CellLogTable({
  moves,
  codeOf,
}: {
  moves: readonly CellMove[];
  codeOf: (id: string) => string | null;
}) {
  const { t } = useTranslation();
  const absent = t('analytics.value.none');
  return (
    <div className="overflow-x-auto rounded-2xl bg-surface shadow-card">
      <table className="w-full text-left text-footnote">
        <caption className="sr-only">{t('analytics.cellLog.title')}</caption>
        <thead>
          <tr>
            <HeadCell>{t('analytics.cellLog.date')}</HeadCell>
            <HeadCell>{t('analytics.cellLog.machine')}</HeadCell>
            <HeadCell>{t('analytics.cellLog.cell')}</HeadCell>
            <HeadCell>{t('analytics.cellLog.location')}</HeadCell>
          </tr>
        </thead>
        <tbody>
          {moves.map((move) => (
            <tr key={move.id} className="border-t border-neutral-200">
              <td className="p-2 tabular-nums">{displayDay(move.date)}</td>
              <td className="p-2">
                <Link
                  to={`/analytics/machines/${move.machineId}`}
                  className="inline-flex min-h-target-min items-center font-semibold text-accent-text"
                >
                  {codeOf(move.machineId) ?? absent}
                </Link>
              </td>
              <td className="p-2">
                <Change from={move.fromCell} to={move.toCell} absent={absent} />
              </td>
              <td className="p-2">
                <Change
                  from={move.fromLocation}
                  to={move.toLocation}
                  absent={absent}
                  noChange={t('analytics.cellLog.noChange')}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The cell change log (39b): every move the engine recorded, latest first, with its machine, cell and location
 * change. The export carries the platform's controlled document number. A not-computed engine shows the honest
 * "Not computed yet" and offers no export.
 */
export function CellChangeLog({ figure }: { figure: Figure | undefined }) {
  const { t } = useTranslation();
  const config = useQuery({ queryKey: ['config'], queryFn: getConfig });
  const ready = figure?.status === 'ready';
  const moves = cellMoves(figure?.value);
  const codeOf = (id: string) =>
    config.data?.machines.find((machine) => machine.id === id)?.code ?? null;
  const exportable = ready && moves.length > 0;
  return (
    <Stack gap={4}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-3xl text-body text-neutral-600">{t('analytics.cellLog.intro')}</p>
        <ExportButton moves={moves} codeOf={codeOf} disabled={!exportable} />
      </div>
      {!ready ? (
        <div data-cell-log="not-computed" className="rounded-2xl bg-surface p-4 shadow-card">
          <p className="text-body font-medium text-neutral-600">{t('analytics.notComputed')}</p>
        </div>
      ) : moves.length === 0 ? (
        <p className="text-body text-neutral-600">{t('analytics.cellLog.empty')}</p>
      ) : (
        <CellLogTable moves={moves} codeOf={codeOf} />
      )}
    </Stack>
  );
}
