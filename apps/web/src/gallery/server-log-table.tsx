/* eslint-disable i18next/no-literal-string -- English-only dev fixture (like the rest of the gallery's element data) */
import { useEffect, useState } from 'react';
import { DataTable, LoadingState, MAX_PAGE_ROWS, type Sort } from '../ui/elements/index.js';
import { nextSort } from '../ui/elements/table-model.js';
import { LOG_COLUMNS, TABLE_LABELS, logPage, type LogRow } from './elements-data.js';

/**
 * A list that can pass 200 rows pages on the server (ticket 83): the table keeps only the sort, the filter and the
 * page, asks `fetchPage` for that page, and shows the page and the total it gets back. No row but the page is held.
 */
export function ServerLogTable({ fetchPage = logPage }: { fetchPage?: typeof logPage }) {
  const [sort, setSort] = useState<Sort>();
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(0);
  const [data, setData] = useState<{ rows: LogRow[]; total: number }>();
  useEffect(() => {
    let current = true;
    void fetchPage({ sort, filter, page, pageSize: MAX_PAGE_ROWS }).then((answer) => {
      if (current) setData(answer);
    });
    return () => {
      current = false;
    };
  }, [fetchPage, sort, filter, page]);
  if (!data) return <LoadingState label="Loading…" tiles={1} />;
  return (
    <DataTable
      columns={LOG_COLUMNS}
      rows={data.rows}
      rowKey={(r) => String(r.id)}
      total={data.total}
      page={page}
      pageSize={MAX_PAGE_ROWS}
      sort={sort}
      filter={filter}
      labels={TABLE_LABELS}
      onSort={(column) => {
        setSort(nextSort(sort, column));
        setPage(0);
      }}
      onFilter={(text) => {
        setFilter(text);
        setPage(0);
      }}
      onPage={setPage}
    />
  );
}
