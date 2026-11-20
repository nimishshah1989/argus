/* eslint-disable i18next/no-literal-string -- icon names and typed unions only; every visible word comes in as a prop or t() */
import { useEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from './icons.js';

/** What the drawer shows: its name for a screen reader, its content, and how to close it. */
export type DrawerSpec = { label: string; content: ReactNode; onClose: () => void };

/** The right drawer: open only while something is selected; ✕ or Esc closes it and focus goes back where it was. */
export function Drawer({ drawer }: { drawer: DrawerSpec | null }) {
  const { t } = useTranslation();
  const close = useRef<HTMLButtonElement>(null);
  const back = useRef<HTMLElement | null>(null);
  const open = drawer?.label;
  const onClose = useRef(drawer?.onClose);
  onClose.current = drawer?.onClose;
  useEffect(() => {
    if (open === undefined) return;
    back.current ??= document.activeElement as HTMLElement | null;
    close.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose.current?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  useEffect(() => {
    if (drawer || !back.current) return;
    back.current.focus({ preventScroll: true });
    back.current = null;
  }, [drawer]);
  return (
    <aside className="v2-drawer" aria-label={drawer?.label} inert={!drawer}>
      {drawer ? (
        <div className="v2-drawer-body" key={drawer.label}>
          <button
            ref={close}
            type="button"
            className="v2-icon-btn v2-drawer-close"
            onClick={drawer.onClose}
            aria-label={t('action.label.close')}
          >
            <Icon name="close" size={18} />
          </button>
          {drawer.content}
        </div>
      ) : null}
    </aside>
  );
}
