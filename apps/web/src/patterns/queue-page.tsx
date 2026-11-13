import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useOnline, type ListQuery, type Resource } from '../data/index.js';
import { Button } from '../ui/button.js';
import { Stack } from '../ui/layout.js';
import { PatternFrame, StateNotice } from './frame.js';
import { viewState } from './view-state.js';

export interface QueuePageProps<Row> {
  title: string;
  resource: Resource<unknown, Row>;
  query?: ListQuery;
  row: (item: Row) => ReactNode;
  rowKey: (item: Row) => string;
  /** Translated. */
  empty: string;
}

/** A cursor-paged list with loading, empty, error and offline states. */
export function QueuePage<Row>({
  title,
  resource,
  query,
  row,
  rowKey,
  empty,
}: QueuePageProps<Row>) {
  const { t } = useTranslation();
  const online = useOnline();
  const list = resource.useList(query);
  const items = list.data?.pages.flatMap((page) => page.items) ?? [];
  const state = viewState({
    online,
    hasData: list.data !== undefined,
    isEmpty: items.length === 0,
    error: list.error,
  });
  return (
    <PatternFrame title={title}>
      {state === 'ready' ? (
        <Stack gap={3}>
          <ul className="flex flex-col gap-3">
            {items.map((item) => (
              <li key={rowKey(item)}>{row(item)}</li>
            ))}
          </ul>
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
