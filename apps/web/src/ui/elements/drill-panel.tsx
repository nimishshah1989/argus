import type { ReactNode } from 'react';
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
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  closeLabel: string;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="el-fade fixed inset-0 z-20 bg-neutral-900/40" />
        <Dialog.Content
          aria-describedby={undefined}
          className="el-slide-in fixed inset-y-0 right-0 z-30 flex w-full max-w-md flex-col gap-4 overflow-y-auto bg-surface p-4 shadow-sheet sm:p-6"
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
