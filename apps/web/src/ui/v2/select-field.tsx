/** A labelled choice among many (more than a row of chips holds): "All" first, then the options. */
export function SelectField({
  label,
  all,
  value,
  options,
  onChange,
}: {
  label: string;
  all: string;
  value: string;
  options: { key: string; label: string }[];
  onChange: (key: string) => void;
}) {
  return (
    <label className="v2-select-field">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{all}</option>
        {options.map((o) => (
          <option key={o.key} value={o.key}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
