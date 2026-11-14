import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export type SkeletonShape = 'title' | 'line' | 'short' | 'row' | 'tile';

const SHAPE: Record<SkeletonShape, string> = {
  title: 'h-6 w-2/3 rounded-lg',
  line: 'h-4 w-5/6 rounded-lg',
  short: 'h-4 w-1/4 rounded-lg',
  row: 'h-13 w-full rounded-xl',
  tile: 'h-21 w-full rounded-2xl',
};

/** One grey stand-in for content that is still loading. It pulses unless motion is reduced. */
export function Skeleton({ shape }: { shape: SkeletonShape }) {
  return (
    <span
      aria-hidden
      className={`block bg-gradient-to-r from-neutral-200 to-neutral-100 motion-safe:animate-pulse ${SHAPE[shape]}`}
    />
  );
}

/** Stand-ins in the screen's own layout, then "Loading…" for screen readers and everyone else. */
export function Loading({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3">
      {children}
      <p role="status" className="text-center text-footnote text-neutral-600">
        {t('common.loading')}
      </p>
    </div>
  );
}
