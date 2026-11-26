import { useEffect, useRef, useState, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { SelectField } from './select-field.js';
import { reducedMotion } from './motion.js';

/** One titled part of a page: its heading's anchor (`#id`) and its title. */
export type PageSection = { id: string; title: string };

/** A page needs an index only from this many sections (ADR 0061): fewer, and nothing shows. */
export const MIN_SECTIONS = 3;

/** A heading's anchor: its words, lower case, joined by hyphens ("Repeat offenders" → "repeat-offenders"). */
export const slug = (title: string): string =>
  title
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '') || 'section';

/**
 * The page's sections, in order: every `h2` inside `root` (a `SectionHead`, a `Panel`, a table's or a chart card's
 * title), except one inside a live message. Each heading is marked `data-section` with its anchor, made unique.
 * No per-screen work: whatever the kit titles is in the index.
 */
export function sectionsIn(root: ParentNode): PageSection[] {
  const used = new Map<string, number>();
  return [...root.querySelectorAll<HTMLElement>('h2')].flatMap((h) => {
    const title = h.textContent?.trim() ?? '';
    if (!title || h.closest('[role="alert"], [role="status"], [role="dialog"]')) return [];
    const base = slug(title);
    const n = (used.get(base) ?? 0) + 1;
    used.set(base, n);
    const id = n === 1 ? base : `${base}-${n}`;
    if (h.dataset.section !== id) h.dataset.section = id;
    return [{ id, title }];
  });
}

const headingOf = (id: string) =>
  document.querySelector<HTMLElement>(`[data-section="${CSS.escape(id)}"]`);

/** Scroll to a section, focus its heading (so the keyboard carries on from there) and put it in the address. */
export function jumpTo(id: string): void {
  const h = headingOf(id);
  if (!h) return;
  h.scrollIntoView?.({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
  if (!h.hasAttribute('tabindex')) h.setAttribute('tabindex', '-1');
  h.focus({ preventScroll: true });
  window.history.replaceState(window.history.state, '', `#${id}`);
}

const same = (a: PageSection[], b: PageSection[]) =>
  a.length === b.length && a.every((s, i) => s.id === b[i]?.id && s.title === b[i]?.title);

/**
 * The sections of the page under `root`, kept up to date as the page renders (a table loads, a fold opens). The first
 * time a section named by the address's `#hash` appears, the page scrolls to it, so a link to a section works.
 */
export function useSections(root: RefObject<HTMLElement | null>): PageSection[] {
  const [sections, setSections] = useState<PageSection[]>([]);
  const landed = useRef(false);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const read = () => {
      const now = sectionsIn(el);
      setSections((was) => (same(was, now) ? was : now));
      const want = decodeURIComponent(window.location.hash.slice(1));
      if (!landed.current && want && now.some((s) => s.id === want)) {
        landed.current = true;
        headingOf(want)?.scrollIntoView?.({ block: 'start' });
      }
    };
    read();
    const watch = new MutationObserver(read);
    watch.observe(el, { childList: true, subtree: true, characterData: true });
    return () => watch.disconnect();
  }, [root]);
  return sections;
}

/** Below the sticky header, the line a section must pass to be the one being read. */
const READ_LINE = 120;

/** The section being read: the last whose heading has scrolled up past the reading line (the first, at the top). */
export function useCurrent(sections: PageSection[]): string | undefined {
  const [current, setCurrent] = useState<string>();
  useEffect(() => {
    if (sections.length === 0) return;
    const spy = () => {
      let at = sections[0]?.id;
      for (const s of sections) {
        const h = headingOf(s.id);
        if (h && h.getBoundingClientRect().top <= READ_LINE) at = s.id;
      }
      setCurrent(at);
    };
    spy();
    window.addEventListener('scroll', spy, { passive: true });
    return () => window.removeEventListener('scroll', spy);
  }, [sections]);
  return current;
}

/**
 * "On this page" (ADR 0061, Nimish 26 Nov: "it will be so hard for someone to even remember where is what"): on a
 * wide screen a sticky rail at the right listing the page's sections, the one being read marked; on a phone (or with
 * the drawer open) a compact jump menu at the top of the page. Each entry scrolls to its section and puts it in the
 * address. A page with fewer than `MIN_SECTIONS` sections shows neither.
 */
export function OnThisPage({
  sections,
  current,
  place,
}: {
  sections: PageSection[];
  current?: string;
  place: 'rail' | 'jump';
}) {
  const { t } = useTranslation();
  if (sections.length < MIN_SECTIONS) return null;
  if (place === 'jump')
    return (
      <div className="v2-onpage-jump">
        <SelectField
          label={t('ashell.onPage.jump')}
          all={t('ashell.onPage.top')}
          value={current ?? ''}
          options={sections.map((s) => ({ key: s.id, label: s.title }))}
          onChange={(id) => (id ? jumpTo(id) : window.scrollTo({ top: 0 }))}
        />
      </div>
    );
  return (
    <nav className="v2-onpage-rail" aria-label={t('ashell.onPage.title')}>
      <p className="v2-onpage-title">{t('ashell.onPage.title')}</p>
      <ol>
        {sections.map((s) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              aria-current={s.id === current ? 'location' : undefined}
              onClick={(e) => {
                e.preventDefault();
                jumpTo(s.id);
              }}
            >
              {s.title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
