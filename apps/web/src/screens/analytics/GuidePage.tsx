import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FIGURE_LABELS } from './groups.js';
import { Template } from './shell/patterns/template.js';
import { GUIDE_ENTRIES, guideFigureLinks, type GuideEntry } from './guide-entries.js';

/**
 * The Guide (ticket 45, packet 45f): the key's 36 headings as a contents list, then one entry per heading with
 * our plain-English rule and a link to every figure it explains, on the entity template: one h2, the contents list, then one h3 section per entry. The entries and their links are data in
 * `guide-entries.ts`; this file only renders them. The five features this build does not have print the
 * not-built line instead of a rule.
 */

/** The template: one thing, read top to bottom. */
const KIND = 'entity' as const;

/** The anchor id for one entry; the contents and the section share it. */
const anchorOf = (id: string): string => `guide-${id}`;

function FigureLinks({ entry }: { entry: GuideEntry }) {
  const { t } = useTranslation();
  const links = guideFigureLinks(entry);
  if (links.length === 0) return null;
  return (
    <ul className="mt-3 flex flex-wrap gap-2">
      {links.map((link) => (
        <li key={link.figure}>
          <Link
            to={link.href}
            className="flex min-h-target-min items-center rounded-xl bg-accent-tint px-3 text-footnote font-semibold text-accent-text"
          >
            {t('analytics.guide.openFigure')} —{' '}
            <span>{t(FIGURE_LABELS[link.figure] ?? 'analytics.figure.unknown')}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function GuideSection({ entry }: { entry: GuideEntry }) {
  const { t } = useTranslation();
  const anchor = anchorOf(entry.id);
  return (
    <section
      id={anchor}
      aria-labelledby={`${anchor}-title`}
      className="scroll-mt-24 rounded-card bg-surface p-4 shadow-card"
    >
      <h3 id={`${anchor}-title`} className="text-body font-semibold">
        {t(entry.titleKey)}
      </h3>
      <div className="mt-2 flex max-w-3xl flex-col gap-2 text-body text-neutral-900">
        {entry.bodyKeys.map((key) => (
          <p key={key}>{t(key)}</p>
        ))}
        {entry.formulaKey === undefined ? null : (
          <p className="rounded-xl bg-neutral-100 px-3 py-2 font-mono text-footnote text-neutral-700">
            {t(entry.formulaKey)}
          </p>
        )}
      </div>
      <FigureLinks entry={entry} />
    </section>
  );
}

export function GuidePage() {
  const { t } = useTranslation();
  return (
    <Template
      title={t('analytics.guide.heading')}
      kind={KIND}
      lede={t('analytics.guide.intro')}
      main={
        <>
          <nav aria-label={t('analytics.guide.contents')} className="flex flex-col gap-2">
            <h3 className="text-body font-semibold">{t('analytics.guide.contents')}</h3>
            <ol className="grid grid-cols-1 gap-1 text-body lg:grid-cols-2">
              {GUIDE_ENTRIES.map((entry) => (
                <li key={entry.id}>
                  <a
                    href={`#${anchorOf(entry.id)}`}
                    className="flex min-h-target-min items-center rounded-lg px-2 text-neutral-700 hover:bg-neutral-200"
                  >
                    {t(entry.titleKey)}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
          {GUIDE_ENTRIES.map((entry) => (
            <GuideSection key={entry.id} entry={entry} />
          ))}
        </>
      }
    />
  );
}
