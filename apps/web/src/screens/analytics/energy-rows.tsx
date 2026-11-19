import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { MachineRow } from '@uptimo/domain';
import { MAX_DRILL_IDS } from '@uptimo/shared/analytics';
import { getDrill } from '../../api.js';
import {
  DataTable,
  LoadingState,
  MAX_PAGE_ROWS,
  tableView,
  type Column,
  type Sort,
} from '../../ui/elements/index.js';
import { useTableLabels } from './key-body.js';

const NO_CELL = '—';

/** The ids in runs of at most one drill ask may take (the endpoint refuses more than `MAX_DRILL_IDS`). */
export function chunkIds(ids: readonly string[], size = MAX_DRILL_IDS): string[][] {
  const runs: string[][] = [];
  for (let at = 0; at < ids.length; at += size) runs.push(ids.slice(at, at + size));
  return runs;
}

/** Every machine behind a tile, asked for in runs the endpoint accepts, in the engine's order. */
export async function fetchMachineRows(ids: readonly string[]): Promise<MachineRow[]> {
  const replies = await Promise.all(chunkIds(ids).map((run) => getDrill('machine', run)));
  return replies.flatMap((reply) => reply.rows as MachineRow[]);
}

/** What each column is ordered by. */
const ORDER_BY: Record<string, (row: MachineRow) => string> = {
  code: (row) => row.code,
  cell: (row) => row.cell ?? '',
};

/**
 * One page of a tile's machines, never more than `MAX_PAGE_ROWS`. The data table's own in-memory helper refuses
 * more than 200 rows, and a tile can hold more, so this slices the rows itself with the shared `tableView`.
 */
export function machinePage(rows: MachineRow[], sort: Sort | undefined, page: number) {
  const columns = Object.entries(ORDER_BY).map(([id, sortValue]) => ({
    id,
    header: id,
    sortValue,
    cell: () => null,
  }));
  return tableView(rows, columns, { sort, filter: '', page, pageSize: MAX_PAGE_ROWS }, () => '');
}

/** The two columns of a tile's machines: the code (a link to the machine page) and its cell. */
function machineColumns(t: TFunction): Column<MachineRow>[] {
  return [
    {
      id: 'code',
      header: t('analytics.drill.code'),
      sortValue: ORDER_BY.code,
      cell: (row) => (
        <Link
          to={`/analytics/machines/${row.id}`}
          className="inline-flex min-h-target-min items-center font-semibold text-accent-text"
        >
          {row.code}
        </Link>
      ),
    },
    {
      id: 'cell',
      header: t('analytics.drill.cell'),
      sortValue: ORDER_BY.cell,
      cell: (row) => row.cell ?? NO_CELL,
    },
  ];
}

/**
 * The machines behind one energy tile, in a data table: each code opens that machine's page. The tile's own machine
 * ids come from the engine, so the panel lists exactly the machines the tile counts; a tile with none says so in the
 * face's established words.
 */
export function EnergyRows({
  ids,
  caption,
}: {
  /** The machines the engine put in the tile: the screen never works out a tile's machines itself. */
  ids: readonly string[];
  caption: string;
}) {
  const { t } = useTranslation();
  const [sort, setSort] = useState<Sort>();
  const [page, setPage] = useState(0);
  const reply = useQuery({
    queryKey: ['analytics-energy-rows', ids],
    queryFn: () => fetchMachineRows(ids),
  });
  const labels = useTableLabels(caption);
  const rows = reply.data ?? [];
  const view = machinePage(rows, sort, page);
  if (reply.isLoading) return <LoadingState label={t('common.loading')} tiles={1} />;
  if (reply.error !== null) return <p role="alert">{t('kit.pattern.error')}</p>;
  if (rows.length === 0)
    return <p className="text-body text-neutral-600">{t('analytics.drill.empty')}</p>;
  const columns = machineColumns(t);
  const onSort = (column: string) => {
    setSort(
      sort?.column !== column
        ? { column, dir: 'asc' }
        : sort.dir === 'asc'
          ? { column, dir: 'desc' }
          : undefined,
    );
    setPage(0);
  };
  return (
    <DataTable
      columns={columns}
      rows={view.rows}
      rowKey={(row) => row.id}
      total={view.total}
      page={view.page}
      pageSize={MAX_PAGE_ROWS}
      sort={sort}
      labels={labels}
      onSort={onSort}
      onPage={setPage}
    />
  );
}
