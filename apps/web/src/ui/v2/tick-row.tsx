/** One step to tick: a 52 px row around a real checkbox, so a screen reader and the keyboard work as on any form. */
export function TickRow({
  label,
  checked,
  disabled = false,
  onChange,
}: {
  label: string;
  checked: boolean;
  /** Locked while the work is being sent: it keeps its tick and looks done. */
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="v2-tick-row" data-checked={checked} data-disabled={disabled}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}
