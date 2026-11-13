import { useId, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useOnline, type ListQuery, type Resource } from '../data/index.js';
import { Button } from '../ui/button.js';
import { Inline, Stack } from '../ui/layout.js';
import { PatternFrame, StateNotice } from './frame.js';
import { viewState } from './view-state.js';

export interface BoardGroup {
  id: string;
  title: string;
}
export interface BoardFilter {
  id: string;
  label: string;
  query: ListQuery;
}
export interface BoardPageProps<Row> {
  title: string;
  resource: Resource<unknown, Row>;
  /** In display order; every group shows, even at 0. Rows whose group is not listed are not shown. */
  groups: BoardGroup[];
  /** A BoardGroup id. */
  groupOf: (row: Row) => string;
  tile: (row: Row) => ReactNode;
  rowKey: (row: Row) => string;
  /** The first is selected at start. */
  filters: BoardFilter[];
  empty: string;
}

/** Tiles grouped by status, with filters that stay on screen; the first page only. */
export function BoardPage<Row>(p: BoardPageProps<Row>) {
  const { t } = useTranslation();
  const online = useOnline();
  const baseId = useId();
  const [filterId, setFilterId] = useState(p.filters[0]!.id);
  const current = p.filters.find((f) => f.id === filterId) ?? p.filters[0]!;
  const list = p.resource.useList(current.query);
  const items = list.data?.pages.flatMap((page) => page.items) ?? [];
  const state = viewState({
    online,
    hasData: list.data !== undefined,
    isEmpty: items.length === 0,
    error: list.error,
  });
  return (
    <PatternFrame title={p.title}>
      <div role="group" aria-label={t('kit.board.filter')}>
        <Inline gap={2}>
          {p.filters.map((f) => (
            <Button
              key={f.id}
              // eslint-disable-next-line i18next/no-literal-string -- prop value, not copy
              variant="secondary"
              aria-pressed={f.id === filterId}
              onClick={() => setFilterId(f.id)}
            >
              {f.label}
            </Button>
          ))}
        </Inline>
      </div>
      {state === 'ready' ? (
        p.groups.map((g) => {
          const rows = items.filter((row) => p.groupOf(row) === g.id);
          const headingId = `${baseId}-${g.id}`;
          return (
            <section key={g.id} aria-labelledby={headingId}>
              <Stack gap={2}>
                <h3 id={headingId} className="text-title3 font-semibold">
                  {t('kit.board.group', { title: g.title, count: rows.length })}
                </h3>
                {rows.length > 0 ? (
                  <ul className="flex flex-col gap-3">
                    {rows.map((row) => (
                      <li key={p.rowKey(row)}>{p.tile(row)}</li>
                    ))}
                  </ul>
                ) : null}
              </Stack>
            </section>
          );
        })
      ) : (
        <StateNotice state={state} empty={p.empty} onRetry={() => void list.refetch()} />
      )}
    </PatternFrame>
  );
}
