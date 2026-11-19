/* eslint-disable i18next/no-literal-string -- prop values and ids only; every visible string comes in as a prop */
import type { ReactNode } from 'react';
import { Inbox, TriangleAlert, type IconComponent } from '../icon.js';
import { Button } from '../button.js';
import { Skeleton } from '../loading.js';
import { WRAP } from './tone.js';

/** Nothing to show yet: say what is missing and, when there is one, the way to fill it. */
export function EmptyState({
  title,
  hint,
  action,
  icon: Icon = Inbox,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
  icon?: IconComponent;
}) {
  return (
    <div
      data-state="empty"
      className="flex flex-col items-center gap-2 rounded-card bg-surface p-6 text-center shadow-card"
    >
      <Icon aria-hidden size={32} className="text-neutral-600" />
      <p className={`text-body font-semibold ${WRAP}`}>{title}</p>
      {hint ? <p className={`text-footnote text-neutral-600 ${WRAP}`}>{hint}</p> : null}
      {action}
    </div>
  );
}

/** Grey stand-ins in the shape of the content, announced once as `label` ("Loading…"). */
export function LoadingState({ label, tiles = 3 }: { label: string; tiles?: number }) {
  return (
    <div data-state="loading" className="flex flex-col gap-3">
      {Array.from({ length: tiles }, (_, at) => (
        <Skeleton key={at} shape="tile" />
      ))}
      <p role="status" className="text-center text-footnote text-neutral-600">
        {label}
      </p>
    </div>
  );
}

/** The figures could not load: what happened, and one button to try again. Announced at once. */
export function ErrorState({
  title,
  hint,
  retryLabel,
  onRetry,
}: {
  title: string;
  hint?: string;
  retryLabel: string;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      data-state="error"
      className="flex flex-col items-center gap-2 rounded-card bg-bad-tint p-6 text-center text-bad-ink"
    >
      <TriangleAlert aria-hidden size={32} />
      <p className={`text-body font-bold ${WRAP}`}>{title}</p>
      {hint ? <p className={`text-footnote ${WRAP}`}>{hint}</p> : null}
      <Button variant="secondary" onClick={onRetry}>
        {retryLabel}
      </Button>
    </div>
  );
}
