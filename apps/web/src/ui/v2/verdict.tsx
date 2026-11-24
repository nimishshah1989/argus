import { Segs, type Point } from './points.js';
import { WhyToggle } from './why-toggle.js';

export type VerdictData = { context: string; headline: Point; why: Point[] };

/** The answer first: one sentence on what changed and what to do, its short Why in place, the context under it. */
export function Verdict({ verdict, whyLabel }: { verdict: VerdictData; whyLabel: string }) {
  return (
    <div className="v2-verdict">
      <p className="v2-lede">
        <Segs point={verdict.headline} />
      </p>
      {verdict.why.length > 0 ? <WhyToggle label={whyLabel} points={verdict.why} /> : null}
      <p className="v2-sub">{verdict.context}</p>
    </div>
  );
}
