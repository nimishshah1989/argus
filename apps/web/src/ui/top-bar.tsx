import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from './icon.js';

/**
 * The screen header: a title (or a back link) with an optional line under it, and one trailing item
 * (the sync pill or a step count). A detail screen passes `back` instead of a title.
 */
export function TopBar({
  title,
  subtitle,
  trailing,
  back,
}: {
  title?: string;
  subtitle?: string;
  trailing?: ReactNode;
  back?: { to: string; label: string };
}) {
  return (
    <header className="sticky top-0 z-10 flex min-h-14 items-center justify-between gap-3 border-b border-neutral-200 bg-surface px-4 py-2">
      <div className="flex flex-col">
        {back ? (
          <Link
            to={back.to}
            className="-ml-2 inline-flex min-h-target-min items-center gap-1 rounded-xl px-2 text-body font-medium"
          >
            <ChevronLeft aria-hidden size={20} />
            {back.label}
          </Link>
        ) : null}
        {title ? <h1 className="text-title3 font-bold leading-tight">{title}</h1> : null}
        {subtitle ? <p className="text-caption text-neutral-600">{subtitle}</p> : null}
      </div>
      {trailing}
    </header>
  );
}
