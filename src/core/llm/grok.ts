import OpenAI from 'openai';
import { ResolvedModelConfig, LLMCallOptions, LLMMessage, LLMResponse, HageezError } from '../types';
import { providerTimeout, withProviderRetry, type ProviderTransport } from './provider';

const GROK_BASE_URL = 'https://api.x.ai/v1';

interface GrokCompletionResponse {
  choices?: Array<{ message?: { content?: string | null } }>;
  usage?: { total_tokens?: number };
  model?: string;
}

export async function callGrok(
  config: ResolvedModelConfig,
  messages: LLMMessage[],
  options: LLMCallOptions = {},
  transport?: ProviderTransport
): Promise<LLMResponse> {
  const client = transport
    ? undefined
    : new OpenAI({
        apiKey: config.apiKey,
        baseURL: GROK_BASE_URL,
        timeout: providerTimeout(config),
        maxRetries: 0,
      });
  const create = transport
    ? transport.create.bind(transport)
    : client!.chat.completions.create.bind(client!.chat.completions);
  const start = Date.now();

  const response = (await withProviderRetry('grok', config, options, (request) =>
    create(
      {
        model: config.model,
        messages: messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
        max_tokens: config.maxTokens,
        temperature: config.temperature,
      },
      { signal: request.signal, timeout: request.timeout }
    )
  )) as GrokCompletionResponse;

  const choice = response.choices?.[0];
  if (!choice?.message?.content) {
    throw new HageezError('GROK_EMPTY_RESPONSE', 'Grok returned empty response');
  }

  return {
    content: choice.message.content,
    tokensUsed: response.usage?.total_tokens ?? 0,
    model: response.model ?? config.model,
    provider: 'grok',
    durationMs: Date.now() - start,
  };
}
