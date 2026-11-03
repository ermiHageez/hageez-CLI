import OpenAI from 'openai';
import { ResolvedModelConfig, LLMCallOptions, LLMMessage, LLMResponse, HageezError } from '../types';
import { providerTimeout, withProviderRetry, type ProviderTransport } from './provider';

interface OpenAICompletionResponse {
  choices?: Array<{ message?: { content?: string | null } }>;
  usage?: { total_tokens?: number };
  model?: string;
}

export async function callOpenAI(
  config: ResolvedModelConfig,
  messages: LLMMessage[],
  options: LLMCallOptions = {},
  transport?: ProviderTransport
): Promise<LLMResponse> {
  const client = transport
    ? undefined
    : new OpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseUrl,
        timeout: providerTimeout(config),
        maxRetries: 0,
        fetch: async (url, init) => {
          const res = await fetch(url, init);
          if (!res.ok) {
            const clone = res.clone();
            try {
              const data = await clone.json();
              if (Array.isArray(data) && data[0]?.error) {
                return new Response(JSON.stringify({ error: data[0].error }), {
                  status: res.status,
                  statusText: res.statusText,
                  headers: res.headers,
                });
              }
            } catch {
              // ignore json parse error
            }
          }
          return res;
        },
      });
  const create = transport
    ? transport.create.bind(transport)
    : client!.chat.completions.create.bind(client!.chat.completions);
  const start = Date.now();

  const provider = config.provider === 'openai-compatible' ? 'openai-compatible' : 'openai';
  const response = (await withProviderRetry(provider, config, options, (request) =>
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
  )) as OpenAICompletionResponse;

  const choice = response.choices?.[0];
  if (!choice?.message?.content) {
    throw new HageezError('OPENAI_EMPTY_RESPONSE', 'OpenAI returned empty response');
  }

  return {
    content: choice.message.content,
    tokensUsed: response.usage?.total_tokens ?? 0,
    model: response.model ?? config.model,
    provider: config.provider === 'openai-compatible' ? 'openai-compatible' : 'openai',
    durationMs: Date.now() - start,
  };
}
