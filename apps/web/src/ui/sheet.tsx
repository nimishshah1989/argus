import { Dialog } from 'radix-ui';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from './icon.js';

/** From 1024 px the sheet is the edit panel: full height on the right edge, a hairline on its left. */
const PANEL =
  'lg:top-0 lg:right-0 lg:bottom-0 lg:left-auto lg:max-h-none lg:w-[clamp(340px,26.5vw,400px)] lg:rounded-none lg:border-l lg:border-neutral-200 lg:p-6 lg:shadow-none';

/** The one modal: a bottom sheet on a phone, a right side panel from 1024 px. Radix gives the focus trap and Escape. */
export function Sheet({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-20 bg-neutral-900/40 transition-opacity duration-(--motion-slow)" />
        <Dialog.Content
          aria-describedby={undefined}
          className={`fixed inset-x-0 bottom-0 z-20 flex max-h-[85dvh] flex-col gap-4 overflow-y-auto rounded-t-sheet bg-surface p-4 shadow-sheet transition-transform duration-(--motion-slow) ${PANEL}`}
        >
          <div className="flex items-center justify-between gap-4">
            <Dialog.Title className="text-title3 font-semibold">{title}</Dialog.Title>
            <Dialog.Close
              aria-label={t('kit.sheet.close')}
              className="flex min-h-target min-w-target items-center justify-center rounded-xl"
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
