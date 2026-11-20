import { useId, type ReactNode, type Ref } from 'react';

/**
 * A labelled day field: the browser's own date control, so the keyboard, the phone's picker and a screen reader all
 * work as the reader's device does. Enter inside it submits the form around it.
 */
export function DateField({
  label,
  value,
  onChange,
  inputRef,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  inputRef?: Ref<HTMLInputElement>;
  /** What sits beside the field: its confirm and cancel buttons. */
  children?: ReactNode;
}) {
  const id = useId();
  return (
    <div className="v2-date-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        ref={inputRef}
        type="date"
        value={value}
        required
        onChange={(e) => onChange(e.target.value)}
      />
      {children}
    </div>
  );
}
