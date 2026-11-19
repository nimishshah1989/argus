/* eslint-disable i18next/no-literal-string -- prop values and ids only; every visible string comes in as a prop */
import { useId } from 'react';
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

type RangeProps = NonNullable<Parameters<typeof PeriodPicker>[0]['range']>;
const rangeWith = (range: RangeProps, end: 'from' | 'to', typed: string): DateRange => ({
  from: end === 'from' ? typed : range.from.value,
  to: end === 'to' ? typed : range.to.value,
});

/**
 * Pick the time a screen covers: a few named periods (Today, 7 days, Year) and, when `range` is given, own dates.
 * The chosen period is pressed; its tap target is 44 px. Typing a date calls `range.onChange` with what is typed
 * (never reordered mid-edit); leaving a field puts a backwards range the right way round. The caller must then set
 * `value` to `undefined`: the picker does not clear the named period itself.
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
  const uid = useId();
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
              <Label htmlFor={`${uid}-${end}`}>{range[end].label}</Label>
              <input
                id={`${uid}-${end}`}
                type="date"
                value={range[end].value}
                onChange={(event) => range.onChange(rangeWith(range, end, event.target.value))}
                onBlur={() => range.onChange(orderedRange(rangeWith(range, end, range[end].value)))}
                className="min-h-target w-full min-w-0 rounded-lg border border-control bg-surface px-3 text-body"
              />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
