/* eslint-disable i18next/no-literal-string -- prop values and ids only; every visible string comes in as a prop */
import { Label } from '../input.js';

export interface Period {
  id: string;
  label: string;
}

export interface DateRange {
  from: string;
  to: string;
}

/** A range typed backwards ("to" before "from") is put the right way round; empty ends stay as they are. */
export function orderedRange(range: DateRange): DateRange {
  const { from, to } = range;
  return from && to && from > to ? { from: to, to: from } : range;
}

/**
 * Pick the time a screen covers: a few named periods (Today, 7 days, Year) and, when `range` is given, own dates.
 * The chosen period is pressed; its tap target is 44 px. Choosing dates clears the named period.
 */
export function PeriodPicker({
  label,
  periods,
  value,
  onChange,
  range,
}: {
  label: string;
  periods: Period[];
  /** The id of the chosen period; `undefined` when a date range is in use. */
  value: string | undefined;
  onChange: (id: string) => void;
  range?: {
    from: { label: string; value: string };
    to: { label: string; value: string };
    onChange: (range: DateRange) => void;
  };
}) {
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div role="group" aria-label={label} className="flex flex-wrap gap-2">
        {periods.map((period) => (
          <button
            key={period.id}
            type="button"
            aria-pressed={period.id === value}
            onClick={() => onChange(period.id)}
            className="min-h-target-min min-w-target-min rounded-chip border border-control px-4 text-footnote font-semibold break-words text-neutral-900 aria-pressed:border-accent-strong aria-pressed:bg-accent-tint aria-pressed:text-accent-text"
          >
            {period.label}
          </button>
        ))}
      </div>
      {range ? (
        <div className="grid grid-cols-2 gap-3">
          {(['from', 'to'] as const).map((end) => (
            <div key={end} className="flex min-w-0 flex-col gap-1">
              <Label htmlFor={`period-${end}`}>{range[end].label}</Label>
              <input
                id={`period-${end}`}
                type="date"
                value={range[end].value}
                onChange={(event) =>
                  range.onChange(
                    orderedRange({
                      from: end === 'from' ? event.target.value : range.from.value,
                      to: end === 'to' ? event.target.value : range.to.value,
                    }),
                  )
                }
                className="min-h-target w-full min-w-0 rounded-lg border border-control bg-surface px-3 text-body"
              />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
