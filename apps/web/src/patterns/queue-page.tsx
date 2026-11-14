import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useOnline, type ListQuery, type Resource } from '../data/index.js';
import { Button } from '../ui/button.js';
import { Stack } from '../ui/layout.js';
import { PatternFrame, StateNotice } from './frame.js';
import { QueueTable, type QueueColumn } from './queue-table.js';
import { viewState } from './view-state.js';
import { useWide } from './wide.js';

export interface QueuePageProps<Row> {
  title: string;
  resource: Resource<unknown, Row>;
  query?: ListQuery;
  row: (item: Row) => ReactNode;
  /** From 1024 px the rows become a table with these columns (the first is the row header). */
  columns?: QueueColumn<Row>[];
  rowKey: (item: Row) => string;
  /** Translated. */
  empty: string;
  /** Hide the sync pill while online (the floor). */
  quietOnline?: boolean;
}

/** A cursor-paged list with loading, empty, error and offline states. */
export function QueuePage<Row>({
  title,
  resource,
  query,
  row,
  columns,
  rowKey,
  empty,
  quietOnline,
}: QueuePageProps<Row>) {
  const { t } = useTranslation();
  const online = useOnline();
  const wide = useWide();
  const list = resource.useList(query);
  const items = list.data?.pages.flatMap((page) => page.items) ?? [];
  const state = viewState({
    online,
    hasData: list.data !== undefined,
    isEmpty: items.length === 0,
    error: list.error,
  });
  return (
    <PatternFrame title={title} quietOnline={quietOnline}>
      {state === 'ready' ? (
        <Stack gap={3}>
          {wide && columns ? (
            <QueueTable title={title} rows={items} columns={columns} rowKey={rowKey} />
          ) : (
            <ul className="flex flex-col gap-3">
              {items.map((item) => (
                <li key={rowKey(item)}>{row(item)}</li>
              ))}
            </ul>
          )}
          {list.hasNextPage ? (
            <Button
              // eslint-disable-next-line i18next/no-literal-string -- prop value, not copy
              variant="secondary"
              disabled={list.isFetchingNextPage}
              onClick={() => void list.fetchNextPage()}
            >
              {list.isFetchingNextPage ? t('common.loading') : t('kit.pattern.more')}
            </Button>
          ) : null}
        </Stack>
      ) : (
        <StateNotice state={state} empty={empty} onRetry={() => void list.refetch()} />
      )}
    </PatternFrame>
  );
}
