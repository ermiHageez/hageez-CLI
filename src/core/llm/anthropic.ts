import Anthropic from '@anthropic-ai/sdk';
import { ResolvedModelConfig, LLMCallOptions, LLMMessage, LLMResponse, HageezError } from '../types';
import { providerTimeout, withProviderRetry, type ProviderTransport } from './provider';

interface AnthropicMessageResponse {
  content?: Array<{ type?: string; text?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number };
  model?: string;
}

export async function callAnthropic(
  config: ResolvedModelConfig,
  messages: LLMMessage[],
  options: LLMCallOptions = {},
  transport?: ProviderTransport
): Promise<LLMResponse> {
  const client = transport
    ? undefined
    : new Anthropic({
        apiKey: config.apiKey,
        timeout: providerTimeout(config),
        maxRetries: 0,
      });
  const create = transport
    ? transport.create.bind(transport)
    : client!.messages.create.bind(client!.messages);
  const start = Date.now();

  const systemMessage = messages.find((message) => message.role === 'system');
  const userMessages = messages.filter((message) => message.role !== 'system');

  const response = (await withProviderRetry('anthropic', config, options, (request) =>
    create(
      {
        model: config.model,
        max_tokens: config.maxTokens,
        temperature: config.temperature,
        system: systemMessage?.content,
        messages: userMessages.map((message) => ({
          role: message.role as 'user' | 'assistant',
          content: message.content,
        })),
      },
      { signal: request.signal, timeout: request.timeout }
    )
  )) as AnthropicMessageResponse;

  const block = response.content?.[0];
  if (!block || block.type !== 'text' || !block.text) {
    throw new HageezError('ANTHROPIC_EMPTY_RESPONSE', 'Anthropic returned empty response');
  }

  return {
    content: block.text,
    tokensUsed: (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0),
    model: response.model ?? config.model,
    provider: 'anthropic',
    durationMs: Date.now() - start,
  };
}
