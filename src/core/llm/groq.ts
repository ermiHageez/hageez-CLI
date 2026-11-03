import OpenAI from 'openai';
import { ResolvedModelConfig, LLMCallOptions, LLMMessage, LLMResponse, HageezError } from '../types';
import { providerTimeout, withProviderRetry, type ProviderTransport } from './provider';

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';

interface GroqCompletionResponse {
  choices?: Array<{ message?: { content?: string | null } }>;
  usage?: { total_tokens?: number };
  model?: string;
}

export async function callGroq(
  config: ResolvedModelConfig,
  messages: LLMMessage[],
  options: LLMCallOptions = {},
  transport?: ProviderTransport
): Promise<LLMResponse> {
  const client = transport
    ? undefined
    : new OpenAI({
        apiKey: config.apiKey,
        baseURL: GROQ_BASE_URL,
        timeout: providerTimeout(config),
        maxRetries: 0,
      });
  const create = transport
    ? transport.create.bind(transport)
    : client!.chat.completions.create.bind(client!.chat.completions);
  const start = Date.now();

  const response = (await withProviderRetry('groq', config, options, (request) =>
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
  )) as GroqCompletionResponse;

  const choice = response.choices?.[0];
  if (!choice?.message?.content) {
    throw new HageezError('GROQ_EMPTY_RESPONSE', 'Groq returned empty response');
  }

  return {
    content: choice.message.content,
    tokensUsed: response.usage?.total_tokens ?? 0,
    model: response.model ?? config.model,
    provider: 'groq',
    durationMs: Date.now() - start,
  };
}
