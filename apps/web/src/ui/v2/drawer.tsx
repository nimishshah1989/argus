/* eslint-disable i18next/no-literal-string -- icon names and typed unions only; every visible word comes in as a prop or t() */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from './icons.js';
import { reducedMotion } from './motion.js';

/**
 * What the drawer shows: its name for a screen reader, its content, and how to close it. `fullPage` is where the
 * same thing has a page of its own, offered as a link in the footer. `id` names the item when its label can change
 * under it (a name that arrives after the figures load): a new `id` is a new item and slides in, a new label is not.
 */
export type DrawerSpec = {
  label: string;
  content: ReactNode;
  onClose: () => void;
  fullPage?: { href: string; label: string };
  id?: string;
};

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
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !e.defaultPrevented && onClose.current?.();
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
        <div className="v2-drawer-body" key={drawer.id ?? drawer.label}>
          <div className="v2-drawer-scroll">
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
          {drawer.fullPage ? (
            <footer className="v2-drawer-foot">
              <a className="v2-btn v2-btn-ghost" href={drawer.fullPage.href}>
                {drawer.fullPage.label}
                <Icon name="up" />
              </a>
            </footer>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}

/**
 * What the drawer does to the page around it. On a phone the open drawer covers the page, so the page behind it is
 * inert and focus stays in the drawer. Charts measure again once the page has reflowed: after the shell's transition
 * ends, or at once under reduced motion, where no transition runs to end.
 */
export function useDrawerFrame(open: boolean): { covered: boolean } {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const query = matchMedia('(max-width: 760px)');
    const update = () => setPhone(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (!reducedMotion()) return;
    const frame = requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    return () => cancelAnimationFrame(frame);
  }, [open]);
  return { covered: open && phone };
}
