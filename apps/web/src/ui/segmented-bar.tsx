/** Two to four lists on one screen; the chosen one is raised. */
export function SegmentedBar({
  label,
  items,
  selected,
  onSelect,
}: {
  label: string;
  items: { id: string; label: string }[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex gap-1 rounded-xl bg-neutral-200 p-1">
      {items.map(({ id, label: itemLabel }) => (
        <button
          key={id}
          type="button"
          aria-pressed={id === selected}
          onClick={() => onSelect(id)}
          className="min-h-target-min flex-1 rounded-lg px-1 text-footnote whitespace-nowrap font-semibold text-neutral-700 aria-pressed:bg-surface aria-pressed:text-neutral-900 aria-pressed:shadow-card"
        >
          {itemLabel}
        </button>
      ))}
    </div>
  );
}
