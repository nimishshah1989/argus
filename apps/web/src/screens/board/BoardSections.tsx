import { useTranslation } from 'react-i18next';
import type { SegmentSection } from './data.js';
import { Tile } from './Tile.js';

export function BoardSections({ sections, large }: { sections: SegmentSection[]; large: boolean }) {
  const { t } = useTranslation();
  if (sections.length === 0) {
    return <p className="mt-6 text-neutral-500">{t('board.noMachines')}</p>;
  }
  return (
    <div className="mt-6 space-y-8">
      {sections.map((section) => (
        <section key={section.id} aria-label={section.label}>
          <h2 className={`font-semibold tracking-tight ${large ? 'text-2xl' : 'text-lg'}`}>
            {section.label}
          </h2>
          <div className="mt-3 space-y-4">
            {section.groups.map((group) => (
              <div key={group.id}>
                {group.label && (
                  <h3 className={`font-medium text-neutral-600 ${large ? 'text-lg' : 'text-sm'}`}>
                    {group.label}
                  </h3>
                )}
                <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                  {group.tiles.map((tile) => (
                    <Tile key={tile.machine.id} tile={tile} large={large} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
