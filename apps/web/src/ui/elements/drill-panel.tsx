import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { Dialog } from 'radix-ui';
import { X } from '../icon.js';
import { WRAP } from './tone.js';

/**
 * Where a drill-down opens: a panel that slides in from the right edge over a scrim (320 ms; none under reduced
 * motion), with a title, a close button and focus kept inside until it closes. Escape and a tap on the scrim close it.
 * The caller decides what the panel is about; `closeLabel` is the close button's name.
 */
export function DrillPanel({
  open,
  onClose,
  title,
  closeLabel,
  family,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  closeLabel: string;
  /** An identity family of the figure the panel explains; it sets `data-family` on the panel, so the family's edge sits on the panel's top edge. Identity, not verdict. */
  family?: string;
  children: ReactNode;
}) {
  // Whatever had focus when the panel opened (the button that asked for it) gets it back when the panel closes.
  const opener = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (open) opener.current = document.activeElement as HTMLElement | null;
  }, [open]);
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="el-scrim fixed inset-0 z-20 bg-scrim" />
        <Dialog.Content
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            opener.current?.focus();
          }}
          data-family={family}
          className="el-panel fixed inset-y-0 right-0 z-30 flex w-full max-w-md flex-col gap-4 overflow-y-auto bg-surface p-4 shadow-panel sm:p-6"
        >
          <div className="flex items-start justify-between gap-3">
            <Dialog.Title className={`text-title3 font-semibold ${WRAP}`}>{title}</Dialog.Title>
            <Dialog.Close
              aria-label={closeLabel}
              className="flex min-h-target-min min-w-target-min shrink-0 items-center justify-center rounded-xl text-neutral-900"
            >
              <X aria-hidden size={20} />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
