import { useTranslation } from 'react-i18next';
import { Segs, type Point } from './points.js';
import type { Status } from './status.js';
import { WhyToggle } from './why-toggle.js';

export type VerdictData = {
  context: string;
  headline: Point;
  why: Point[];
  /** How the page's answer is doing (ADR 0036 R7): good, watch or bad draw a chip and `data-status`; neutral draws nothing. */
  status?: Status;
};

/** The answer first: one sentence on what changed and what to do, its short Why in place, the context under it. */
export function Verdict({ verdict, whyLabel }: { verdict: VerdictData; whyLabel: string }) {
  const { t } = useTranslation();
  // neutral draws nothing: no chip, no attribute
  const status = verdict.status === 'neutral' ? undefined : verdict.status;
  return (
    <div className="v2-verdict" data-status={status}>
      <p className="v2-lede">
        {status ? (
          <span className="v2-status-chip" data-status={status}>
            {t(`insight.status.${status}`)}
          </span>
        ) : null}
        <Segs point={verdict.headline} />
      </p>
      {verdict.why.length > 0 ? <WhyToggle label={whyLabel} points={verdict.why} /> : null}
      <p className="v2-sub">{verdict.context}</p>
    </div>
  );
}
