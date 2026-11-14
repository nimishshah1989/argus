import { contributeTicketListener, defineModule } from '../../kernel/index.js';
import { aiConfigFromEnv } from './config.js';
import { diagnosisQueuer } from './queue.js';

export { aiConfigFromEnv, type AiConfig } from './config.js';
export {
  AiProviderError,
  createFakeProvider,
  pickProvider,
  type AiCompleteRequest,
  type AiCompleteResult,
  type AiJson,
  type AiOutputSchema,
  type AiProvider,
  type AiProviderErrorCode,
  type AiUsage,
  type FakeProvider,
  type FakeReply,
} from './provider.js';

export { AI_SUGGEST_QUEUE, startAiJobs, type AiJobDeps } from './jobs.js';
export type { AiFeature } from './suggest.js';

export const aiModule = defineModule({
  name: 'ai',
  register: () => {
    contributeTicketListener('diagnosis', diagnosisQueuer(aiConfigFromEnv(process.env)));
  },
});
