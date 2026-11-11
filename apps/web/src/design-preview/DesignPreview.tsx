/* eslint-disable i18next/no-literal-string -- Disposable English-only design review. */
import { useState } from 'react';
import { ClipboardList, Info, Wrench } from 'lucide-react';
import { Button, IconLabel } from './components.js';
import { DeskPreview } from './DeskPreview.js';
import { FloorPreview } from './FloorPreview.js';
import './preview.css';

const shell = 'mx-auto w-[calc(100%_-_32px)] max-w-[1248px] sm:w-[calc(100%_-_64px)]';
const activeView = 'border-[var(--line)] bg-white text-[var(--teal)] shadow-sm';
const ui = {
  skip: 'fixed left-2 top-2 z-10 -translate-y-[160%] rounded-xl bg-[var(--teal)] px-[18px] py-3.5 text-white focus:translate-y-0',
  banner:
    'flex min-h-[52px] items-center justify-center gap-2 border-b border-[#cee5e2] bg-[var(--teal-soft)] px-4 py-3 text-center text-sm font-semibold text-[#075753]',
  nav: 'mt-6 grid max-w-[420px] grid-cols-2 gap-1 rounded-2xl bg-[var(--neutral)] p-1',
  title: 'mt-8 text-4xl font-semibold leading-[1.1] tracking-[-0.045em] md:text-5xl',
};
const targets = ['floor', 'desk'] as const;

export function DesignPreview() {
  const [view, setView] = useState<'floor' | 'desk'>('floor');
  return (
    <div className="design-preview">
      <a className={ui.skip} href="#preview-main">
        Skip to preview content
      </a>
      <div className={ui.banner} role="note">
        <IconLabel icon={Info}>Design preview — no actions saved</IconLabel>
      </div>
      <header className={`${shell} py-6 pb-8 sm:pt-8`}>
        <nav className={ui.nav} aria-label="Preview views">
          {targets.map((target) => (
            <Button
              aria-pressed={view === target}
              className={view === target ? activeView : ''}
              icon={target === 'floor' ? Wrench : ClipboardList}
              key={target}
              onClick={() => setView(target)}
              variant="quiet"
            >
              {target === 'floor' ? 'Floor' : 'Desk'}
            </Button>
          ))}
        </nav>
        <h1 className={ui.title}>{view === 'floor' ? 'Report a problem' : 'Open tickets'}</h1>
      </header>
      <main className={`${shell} pb-12`} id="preview-main" tabIndex={-1}>
        {view === 'floor' ? <FloorPreview /> : <DeskPreview />}
      </main>
      <footer
        className={`${shell} border-t border-[var(--line)] py-6 pb-10 text-[13px] text-[var(--muted)]`}
      >
        All people, machines and tickets on this page are synthetic.
      </footer>
    </div>
  );
}
