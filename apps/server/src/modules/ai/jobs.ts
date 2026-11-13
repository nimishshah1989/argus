import type { PgBoss } from 'pg-boss';
import type { Pool } from 'pg';
import type { JobRole } from '../../kernel/index.js';
import type { AiConfig } from './config.js';
import { diagnosisFeature } from './diagnosis.js';
import { pickProvider, type AiProvider } from './provider.js';
import {
  AI_SUGGEST_QUEUE,
  runSuggest,
  type AiFeature,
  type AiFeatures,
  type AiLogLine,
} from './suggest.js';

export { AI_SUGGEST_QUEUE };

export interface AiJobDeps {
  pool: Pool;
  config: AiConfig;
  /** Default `pickProvider(config)`. */
  provider?: AiProvider | null;
  /** Default `{ diagnosis }`. */
  features?: AiFeatures;
  now?: () => Date;
  log?: (line: AiLogLine) => void;
}

/**
 * Creates the queue for every role (senders need it) and, unless the role is `api`, the worker.
 * `retryDelay` 95 s is above the 90 s claim lease, so pg-boss's own single retry (a crash or an
 * unexpected error) can re-claim a `running` row.
 */
export async function startAiJobs(boss: PgBoss, deps: AiJobDeps, role: JobRole): Promise<void> {
  if (!(await boss.getQueue(AI_SUGGEST_QUEUE)))
    await boss.createQueue(AI_SUGGEST_QUEUE, {
      policy: 'standard',
      retryLimit: 1,
      retryDelay: 95,
      expireInSeconds: 90,
    });
  if (role === 'api') return;
  const runtime = {
    pool: deps.pool,
    boss,
    config: deps.config,
    provider: deps.provider === undefined ? pickProvider(deps.config) : deps.provider,
    features: deps.features ?? { diagnosis: diagnosisFeature as AiFeature<unknown> },
    now: deps.now ?? (() => new Date()),
    log: deps.log ?? ((line: AiLogLine) => console.log(JSON.stringify(line))),
  };
  await boss.work(AI_SUGGEST_QUEUE, { batchSize: 1, pollingIntervalSeconds: 2 }, async ([job]) => {
    if (job) await runSuggest(job.data, runtime);
  });
}
