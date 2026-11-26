import { Check } from './icon.js';

/** One step to tick: a 52 px row with a real checkbox, so a screen reader and the keyboard work as on any form. */
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
    <label
      className={`relative flex min-h-target items-center gap-3 rounded-xl border px-3 py-2 ${
        checked ? 'border-accent-strong bg-accent-tint' : 'border-control bg-surface'
      }`}
    >
      <input
        type="checkbox"
        className="peer absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-default"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span
        aria-hidden
        className={`flex size-7 shrink-0 items-center justify-center rounded-lg border-2 peer-focus-visible:ring-2 peer-focus-visible:ring-accent-strong ${
          checked
            ? 'border-accent-strong bg-accent-strong text-accent-ink'
            : 'border-neutral-500 bg-surface'
        }`}
      >
        {checked ? <Check size={18} strokeWidth={3} /> : null}
      </span>
      <span className={`text-body ${disabled ? 'text-neutral-600' : 'text-neutral-900'}`}>
        {label}
      </span>
    </label>
  );
}
