import { useState } from 'react';
import { Field } from './close-kit.js';

export type CodeOption = { value: string; label: string };

/**
 * What a code list shows: the recent codes that are still offered (newest first) and the rest, both narrowed to the
 * search text (matched in the label or the code). The chosen code always stays, so the box never goes blank under it.
 */
export function pickerGroups(
  options: readonly CodeOption[],
  recent: readonly string[],
  query: string,
  chosen: string,
): { recent: CodeOption[]; rest: CodeOption[] } {
  const needle = query.trim().toLowerCase();
  const shows = (option: CodeOption) =>
    option.value === chosen ||
    needle === '' ||
    option.label.toLowerCase().includes(needle) ||
    option.value.toLowerCase().includes(needle);
  const byValue = new Map(options.map((option) => [option.value, option]));
  const first = recent
    .map((value) => byValue.get(value))
    .filter((option): option is CodeOption => option !== undefined && shows(option));
  const taken = new Set(first.map((option) => option.value));
  return { recent: first, rest: options.filter((o) => !taken.has(o.value) && shows(o)) };
}

/**
 * A coded list as a searchable pick (S29): type to narrow the list, then pick; the codes this login used last sit
 * on top. The choice is the plant's list, as before: nothing outside it can be picked.
 */
export function CodePicker(props: {
  id: string;
  label: string;
  value: string;
  options: readonly CodeOption[];
  /** The codes this login used last, newest first. */
  recent: readonly string[];
  onChange: (value: string) => void;
  /** The empty option's words ("Select"). */
  empty: string;
  /** The search box's words ("Type to search"). */
  search: string;
  /** The heading over the recent codes ("Used last"). */
  recentLabel: string;
  /** The heading over the rest ("All codes"). */
  allLabel: string;
}) {
  const [query, setQuery] = useState('');
  const groups = pickerGroups(props.options, props.recent, query, props.value);
  const option = (o: CodeOption) => (
    <option key={o.value} value={o.value}>
      {o.label}
    </option>
  );
  return (
    <Field id={props.id} label={props.label}>
      <input
        type="search"
        aria-label={props.search}
        aria-controls={props.id}
        placeholder={props.search}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <select
        id={props.id}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
      >
        <option value="">{props.empty}</option>
        {groups.recent.length > 0 ? (
          <>
            <optgroup label={props.recentLabel}>{groups.recent.map(option)}</optgroup>
            <optgroup label={props.allLabel}>{groups.rest.map(option)}</optgroup>
          </>
        ) : (
          groups.rest.map(option)
        )}
      </select>
    </Field>
  );
}
