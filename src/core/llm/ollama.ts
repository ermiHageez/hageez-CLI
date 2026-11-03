import {
  ResolvedModelConfig,
  HageezError,
  LLMCallOptions,
  LLMMessage,
  LLMResponse,
} from '../types';
import { isEmbeddingModel } from './registry';

interface OllamaChatResponse {
  message?: { content?: string };
  prompt_eval_count?: number;
  eval_count?: number;
  model?: string;
}

function baseUrl(config: ResolvedModelConfig): string {
  return (config.baseUrl ?? 'http://127.0.0.1:11434').replace(/\/+$/, '');
}

export async function callOllama(
  config: ResolvedModelConfig,
  messages: LLMMessage[],
  options: LLMCallOptions = {},
  fetchImpl: typeof fetch = fetch
): Promise<LLMResponse> {
  if (isEmbeddingModel(config.model)) {
    throw new HageezError(
      'MODEL_NOT_CHAT',
      `${config.model} is an embedding model and cannot be used for chat.`
    );
  }

  const controller = new AbortController();
  const timeoutMs = config.timeoutMs ?? 300000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const abort = (): void => controller.abort();
  options.signal?.addEventListener('abort', abort, { once: true });
  const start = Date.now();

  try {
    const response = await fetchImpl(`${baseUrl(config)}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model,
        messages: messages.map((message) => ({ role: message.role, content: message.content })),
        stream: false,
        keep_alive: '15m',
        options: {
          temperature: config.temperature,
          num_predict: Math.min(config.maxTokens ?? 2048, 2048),
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new HageezError(
          'MODEL_NOT_FOUND',
          `Ollama model ${config.model} is not installed. Run \`ollama pull ${config.model}\`.`
        );
      }
      if (response.status === 401 || response.status === 403) {
        throw new HageezError('AUTH', 'Ollama authentication failed.');
      }
      throw new HageezError('PROVIDER', `Ollama request failed (HTTP ${response.status}).`);
    }

    const body = (await response.json()) as OllamaChatResponse;
    if (!body.message?.content) {
      throw new HageezError('OLLAMA_EMPTY_RESPONSE', 'Ollama returned an empty response.');
    }

    return {
      content: body.message.content,
      tokensUsed: (body.prompt_eval_count ?? 0) + (body.eval_count ?? 0),
      model: body.model ?? config.model,
      provider: 'ollama',
      durationMs: Date.now() - start,
    };
  } catch (err) {
    if (err instanceof HageezError) throw err;
    if (err instanceof Error && err.name === 'AbortError') {
      throw new HageezError(
        'TIMEOUT',
        `Ollama request timed out after ${Math.round(timeoutMs / 1000)}s.`
      );
    }
    throw new HageezError(
      'PROVIDER_UNREACHABLE',
      `Cannot reach Ollama at ${baseUrl(config)}. Start it with \`ollama serve\`.`
    );
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', abort);
  }
}
