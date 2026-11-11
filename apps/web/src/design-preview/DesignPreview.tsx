/* eslint-disable i18next/no-literal-string -- Disposable English-only design review. */
import { useState } from 'react';
import { ClipboardList, Factory, Info, Wrench } from 'lucide-react';
import { Button, IconLabel } from './components.js';
import { DeskPreview } from './DeskPreview.js';
import { FloorPreview } from './FloorPreview.js';
import './preview.css';

type PreviewView = 'floor' | 'desk';

export function DesignPreview() {
  const [view, setView] = useState<PreviewView>('floor');
  const floorActive = view === 'floor';
  return (
    <div className="design-preview">
      <a className="preview-skip-link" href="#preview-main">
        Skip to preview content
      </a>
      <div className="preview-banner" role="note">
        <Info aria-hidden="true" size={19} strokeWidth={1.8} />
        <span>Design preview — no actions saved</span>
      </div>
      <header className="preview-header">
        <div className="preview-brand-row">
          <IconLabel className="preview-brand" icon={Factory}>
            uptimo
          </IconLabel>
          <span className="preview-review-label">D0 design study</span>
        </div>
        <nav className="preview-view-switch" aria-label="Preview views">
          <Button
            aria-pressed={floorActive}
            icon={Wrench}
            onClick={() => setView('floor')}
            variant="quiet"
          >
            Floor
          </Button>
          <Button
            aria-pressed={!floorActive}
            icon={ClipboardList}
            onClick={() => setView('desk')}
            variant="quiet"
          >
            Desk
          </Button>
        </nav>
        <div className="preview-heading">
          <p className="preview-eyebrow">{floorActive ? 'FLOOR' : 'DESK'}</p>
          <h1>{floorActive ? 'Report a problem' : 'Open tickets'}</h1>
          <p>
            {floorActive
              ? 'From machine to sent report in three clear steps.'
              : 'Machine condition and work progress, together at a glance.'}
          </p>
        </div>
      </header>
      <main className="preview-main" id="preview-main" tabIndex={-1}>
        {floorActive ? <FloorPreview /> : <DeskPreview />}
      </main>
      <footer className="preview-footer">
        All people, machines and tickets on this page are synthetic.
      </footer>
    </div>
  );
}
