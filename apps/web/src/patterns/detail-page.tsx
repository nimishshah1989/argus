import type { ReactNode } from 'react';
import { useOnline, type Resource } from '../data/index.js';
import { Card } from '../ui/card.js';
import { Inline, Stack } from '../ui/layout.js';
import { PatternFrame, StateNotice } from './frame.js';
import { viewState, type ViewState } from './view-state.js';

export interface DetailFact {
  label: string;
  value: string;
}
export interface DetailSection {
  title: string;
  body: ReactNode;
}
export interface DetailPageProps<T> {
  title: string;
  resource: Resource<T, unknown>;
  id: string;
  facts: (item: T) => DetailFact[];
  sections?: (item: T) => DetailSection[];
  /** The action bar slot. */
  actions?: (item: T) => ReactNode;
  /** Shown for a not_found answer. */
  empty: string;
}

/** One record: facts, sections and an action bar, with loading, empty, error and offline states. */
export function DetailPage<T>({
  title,
  resource,
  id,
  facts,
  sections,
  actions,
  empty,
}: DetailPageProps<T>) {
  const online = useOnline();
  const one = resource.useOne(id);
  const item = one.data;
  const state = viewState({
    online,
    hasData: item !== undefined,
    isEmpty: false,
    error: one.error,
  });
  return (
    <PatternFrame title={title}>
      {state === 'ready' && item !== undefined ? (
        <Stack gap={3}>
          <dl className="grid grid-cols-2 gap-2">
            {facts(item).flatMap((fact) => [
              <dt key={`${fact.label}-t`} className="text-footnote text-neutral-600">
                {fact.label}
              </dt>,
              <dd key={`${fact.label}-d`} className="text-body">
                {fact.value}
              </dd>,
            ])}
          </dl>
          {sections?.(item).map((section) => (
            <Card key={section.title} title={section.title}>
              {section.body}
            </Card>
          ))}
          {actions ? <Inline gap={2}>{actions(item)}</Inline> : null}
        </Stack>
      ) : (
        <StateNotice
          state={state as Exclude<ViewState, 'ready'>}
          empty={empty}
          onRetry={() => void one.refetch()}
        />
      )}
    </PatternFrame>
  );
}
