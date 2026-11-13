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
      {sections.map((section) => {
        const name = section.other ? t('board.other') : section.label;
        return (
          <section key={section.id} aria-label={name ?? undefined}>
            <h2 className={`font-semibold tracking-tight ${large ? 'text-2xl' : 'text-lg'}`}>
              {name}
            </h2>
            <div className="mt-3 space-y-4">
              {section.groups.map((group) => {
                const groupName = group.other ? t('board.other') : group.label;
                return (
                  <div key={group.id}>
                    {groupName && (
                      <h3
                        className={`font-medium text-neutral-600 ${large ? 'text-lg' : 'text-sm'}`}
                      >
                        {groupName}
                      </h3>
                    )}
                    <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                      {group.tiles.map((tile) => (
                        <Tile key={tile.machine.id} tile={tile} large={large} />
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
