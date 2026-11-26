/* eslint-disable i18next/no-literal-string -- icon names only; every visible word goes through t() */
import { Dialog } from 'radix-ui';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from './icons.js';

/**
 * The phone's modal on the v2 kit: a bottom sheet at 360 px, a right panel from 1024 px (`bottom-sheet.css`).
 * Radix gives the focus trap, Escape and the return of focus; the title is the dialog's name (`h2`), then ✕.
 * For the floor and any page without the v2 Shell; inside the Shell the right `Drawer` is the panel.
 */
export function BottomSheet({
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
        <Dialog.Overlay className="v2-sheet-scrim" />
        <Dialog.Content aria-describedby={undefined} className="v2-app v2-sheet">
          <div className="v2-sheet-head">
            <Dialog.Title className="v2-sheet-title">{title}</Dialog.Title>
            <Dialog.Close aria-label={t('kit.sheet.close')} className="v2-icon-btn v2-sheet-close">
              <Icon name="close" size={20} />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
