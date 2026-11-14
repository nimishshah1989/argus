import type { ReactNode } from 'react';

/** The D04 spacing set (4, 8, 12, 16, 24, 32, 48 px) as Tailwind's 4 px steps. */
export type Space = 1 | 2 | 3 | 4 | 6 | 8 | 12;

const GAP: Record<Space, string> = {
  1: 'gap-1',
  2: 'gap-2',
  3: 'gap-3',
  4: 'gap-4',
  6: 'gap-6',
  8: 'gap-8',
  12: 'gap-12',
};
const COLUMNS = { 2: 'grid-cols-2', 3: 'grid-cols-3' };

export function Page({ title, children }: { title?: string; children?: ReactNode }) {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4">
      {title ? <h1 className="text-title2 font-semibold">{title}</h1> : null}
      {children}
    </main>
  );
}

export function Stack({ gap = 4, children }: { gap?: Space; children: ReactNode }) {
  return <div className={`flex flex-col ${GAP[gap]}`}>{children}</div>;
}

export function Inline({
  gap = 4,
  wrap = true,
  children,
}: {
  gap?: Space;
  wrap?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`flex items-center ${wrap ? 'flex-wrap' : ''} ${GAP[gap]}`}>{children}</div>
  );
}

export function Grid({
  columns,
  gap = 4,
  children,
}: {
  columns: 2 | 3;
  gap?: Space;
  children: ReactNode;
}) {
  return <div className={`grid ${COLUMNS[columns]} ${GAP[gap]}`}>{children}</div>;
}

/** A full-height screen with a bar pinned under its content (the floor's and desk's tab bar). */
export function Shell({ bar, children }: { bar: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="flex-1">{children}</div>
      {bar}
    </div>
  );
}
