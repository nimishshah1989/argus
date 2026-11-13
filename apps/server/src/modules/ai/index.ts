import { defineModule } from '../../kernel/index.js';

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

export const aiModule = defineModule({ name: 'ai', register: () => undefined });
