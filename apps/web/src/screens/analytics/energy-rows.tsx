import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { MachineRow } from '@uptimo/domain';
import { getDrill } from '../../api.js';
import { DataTable, LoadingState, useClientTable, type Column } from '../../ui/elements/index.js';
import { useTableLabels } from './key-body.js';

const NO_CELL = '—';

const text = (row: MachineRow) => `${row.code} ${row.cell ?? ''}`;

/**
 * The machines behind one energy tile, in a data table: each code opens that machine's page. The figure's own
 * machine drill reply is narrowed by `where`; a tile with none says so in the face's established words.
 */
export function EnergyRows({
  ids,
  where,
  caption,
}: {
  ids: readonly string[];
  where: (row: MachineRow) => boolean;
  caption: string;
}) {
  const { t } = useTranslation();
  const reply = useQuery({
    queryKey: ['analytics-drill', 'machine', ids],
    queryFn: () => getDrill('machine', ids),
  });
  const labels = useTableLabels(caption);
  const rows = ((reply.data?.rows ?? []) as MachineRow[]).filter(where);
  const columns: Column<MachineRow>[] = [
    {
      id: 'code',
      header: t('analytics.drill.code'),
      sortValue: (row) => row.code,
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
      sortValue: (row) => row.cell ?? '',
      cell: (row) => row.cell ?? NO_CELL,
    },
  ];
  const table = useClientTable(rows, columns, text, 50);
  if (reply.isLoading) return <LoadingState label={t('common.loading')} tiles={1} />;
  if (reply.error !== null) return <p role="alert">{t('kit.pattern.error')}</p>;
  if (rows.length === 0)
    return <p className="text-body text-neutral-600">{t('analytics.drill.empty')}</p>;
  return (
    <DataTable
      columns={columns}
      rows={table.rows}
      rowKey={(row) => row.id}
      total={table.total}
      page={table.page}
      pageSize={table.pageSize}
      sort={table.sort}
      labels={labels}
      onSort={table.onSort}
      onPage={table.onPage}
    />
  );
}
