import { HageezError, LLMCallOptions, ResolvedModelConfig } from '../types';

export const DEFAULT_TIMEOUT_MS = 60000;
const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 100;
const MAX_DELAY_MS = 1000;

export interface ProviderRequestOptions {
  signal?: AbortSignal;
  timeout?: number;
}

export interface ProviderTransport {
  create(params: unknown, options?: ProviderRequestOptions): Promise<unknown>;
}

const PROVIDER_NAMES: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  grok: 'Grok',
  groq: 'Groq',
  'openai-compatible': 'OpenAI-compatible provider',
  ollama: 'Ollama',
};

export function providerTimeout(config: Pick<ResolvedModelConfig, 'timeoutMs'>): number {
  return config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
}

function errorStatus(err: unknown): number | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const candidate = err as {
    status?: unknown;
    statusCode?: unknown;
    response?: { status?: unknown };
  };

  for (const value of [candidate.status, candidate.statusCode, candidate.response?.status]) {
    if (typeof value === 'number') return value;
  }

  return undefined;
}

function errorCode(err: unknown): string | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const code = (err as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

function errorName(err: unknown): string | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const name = (err as { name?: unknown }).name;
  return typeof name === 'string' ? name : undefined;
}

function isTimeout(err: unknown): boolean {
  const code = errorCode(err);
  if (code && ['ETIMEDOUT', 'ECONNABORTED', 'ESOCKETTIMEDOUT'].includes(code)) {
    return true;
  }

  const name = errorName(err);
  if (
    name &&
    ['AbortError', 'APIUserAbortError', 'APIConnectionTimeoutError', 'TimeoutError'].includes(name)
  ) {
    return true;
  }

  const message = err instanceof Error ? err.message : '';
  return /timed?\s*out|timeout|aborted/i.test(message);
}

function isRetryable(err: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) return false;
  if (err instanceof HageezError) return false;

  const status = errorStatus(err);
  if (status === 429 || (status !== undefined && status >= 500 && status <= 599)) {
    return true;
  }

  if (isTimeout(err)) return true;

  const code = errorCode(err);
  return Boolean(
    code &&
      ['ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN'].includes(code)
  );
}

function errorDetail(err: unknown): string | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const candidate = err as {
    message?: unknown;
    error?: { message?: unknown } | Array<{ error?: { message?: unknown } }>;
    response?: { data?: { error?: { message?: unknown } } };
  };
  if (Array.isArray(candidate.error) && candidate.error[0]?.error?.message) {
    return String(candidate.error[0].error.message).trim();
  }
  if (typeof candidate.error === 'object' && candidate.error !== null && 'message' in candidate.error && candidate.error.message) {
    return String(candidate.error.message).trim();
  }
  if (candidate.response?.data?.error?.message) {
    return String(candidate.response.data.error.message).trim();
  }
  if (typeof candidate.message === 'string' && candidate.message.trim()) {
    const clean = candidate.message.replace(/^(?:Error:\s*|\d{3}\s+)/i, '').trim();
    if (clean && !clean.includes('[object Object]')) {
      return clean;
    }
  }
  return undefined;
}

export function mapProviderError(provider: string, err: unknown): HageezError {
  if (err instanceof HageezError) return err;

  const name = PROVIDER_NAMES[provider] ?? provider;
  const status = errorStatus(err);
  const detail = errorDetail(err);
  const suffix = detail ? `: ${detail}` : '.';

  if (status === 401 || status === 403) {
    return new HageezError('AUTH', `${name} authentication failed.`);
  }
  if (status === 429) {
    return new HageezError('RATE_LIMIT', `${name} rate limit reached.`);
  }
  if (isTimeout(err)) {
    return new HageezError('TIMEOUT', `${name} request timed out.`);
  }

  return new HageezError('PROVIDER', `${name} request failed${suffix}`);
}

function backoffDelay(attempt: number): number {
  const base = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** attempt);
  return Math.round(base * (0.5 + Math.random() * 0.5));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withProviderRetry<T>(
  provider: string,
  config: Pick<ResolvedModelConfig, 'timeoutMs'>,
  options: LLMCallOptions,
  operation: (request: ProviderRequestOptions) => Promise<T>
): Promise<T> {
  const requestOptions: ProviderRequestOptions = {
    signal: options.signal,
    timeout: providerTimeout(config),
  };

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (options.signal?.aborted) {
      throw new HageezError('TIMEOUT', `${PROVIDER_NAMES[provider] ?? provider} request aborted.`);
    }

    try {
      return await operation(requestOptions);
    } catch (err) {
      const mapped = mapProviderError(provider, err);
      if (
        attempt === MAX_ATTEMPTS - 1 ||
        options.signal?.aborted ||
        !isRetryable(err, options.signal)
      ) {
        throw mapped;
      }
      await sleep(backoffDelay(attempt));
    }
  }

  throw new HageezError('PROVIDER', `${PROVIDER_NAMES[provider] ?? provider} request failed.`);
}
