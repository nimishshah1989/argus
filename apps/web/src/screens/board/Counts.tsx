import type { BoardCounts } from './data.js';

const ITEMS = [
  { key: 'total', label: 'Open' },
  { key: 'stopped', label: 'Stopped' },
  { key: 'waiting', label: 'Waiting' },
  { key: 'support', label: 'Support' },
  { key: 'workRequests', label: 'Work requests' },
] as const;

export function Counts({ counts, large }: { counts: BoardCounts; large: boolean }) {
  return (
    <section aria-label="Board counts" className="mt-4">
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {ITEMS.map((item) => (
          <div key={item.key} className="rounded-xl bg-white p-3 shadow-sm">
            <dt className={`text-neutral-500 ${large ? 'text-base' : 'text-xs'}`}>{item.label}</dt>
            <dd
              data-testid={`count-${item.key}`}
              className={`mt-0.5 font-semibold tracking-tight ${large ? 'text-4xl' : 'text-2xl'}`}
            >
              {counts[item.key]}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
