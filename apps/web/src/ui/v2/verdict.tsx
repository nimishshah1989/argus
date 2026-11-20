import { MoneyFigure, type Figure } from './money-figure.js';
import { Segs, type Point } from './points.js';
import { WhyToggle } from './why-toggle.js';

export type VerdictData = { context: string; headline: Point; why: Point[]; figures: Figure[] };

/** The page's one sentence verdict, its Why, and the figures that size it. */
export function Verdict({ verdict, whyLabel }: { verdict: VerdictData; whyLabel: string }) {
  return (
    <header className="v2-verdict">
      <div className="v2-verdict-text">
        <span className="v2-note">{verdict.context}</span>
        <h1 className="v2-hero">
          <Segs point={verdict.headline} />
        </h1>
        <WhyToggle label={whyLabel} points={verdict.why} />
      </div>
      <div className="v2-figures">
        {verdict.figures.map((f) => (
          <MoneyFigure key={f.label} figure={f} />
        ))}
      </div>
    </header>
  );
}
