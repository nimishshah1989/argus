import type { ReactNode } from 'react';

/** The screen header: title, an optional line under it, and one trailing item (the sync pill or a step count). */
export function TopBar({
  title,
  subtitle,
  trailing,
}: {
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-10 flex min-h-14 items-center justify-between gap-3 border-b border-neutral-200 bg-surface px-4 py-2">
      <div className="flex flex-col">
        <h1 className="text-title3 font-bold leading-tight">{title}</h1>
        {subtitle ? <p className="text-caption text-neutral-600">{subtitle}</p> : null}
      </div>
      {trailing}
    </header>
  );
}
