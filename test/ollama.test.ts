import { test } from 'node:test';
import assert from 'node:assert/strict';
import { callOllama } from '../src/core/llm/ollama';
import { ResolvedModelConfig, HageezError } from '../src/core/types';

function config(overrides: Partial<ResolvedModelConfig> = {}): ResolvedModelConfig {
  return {
    provider: 'ollama',
    apiKey: '',
    model: 'qwen2.5-coder:7b',
    baseUrl: 'http://127.0.0.1:11434',
    maxTokens: 512,
    temperature: 0.1,
    memoryEnabled: true,
    ragEnabled: true,
    telemetryEnabled: false,
    timeoutMs: 300000,
    connectionName: 'local',
    ...overrides,
  };
}

test('Ollama chat returns text and token usage without an API key', async () => {
  let requested = '';
  const fakeFetch = (async (url: string | URL | Request, init?: RequestInit) => {
    requested = String(url);
    const body = JSON.parse(String(init?.body));
    assert.equal(body.model, 'qwen2.5-coder:7b');
    assert.equal(body.stream, false);
    assert.equal(body.keep_alive, '15m');
    assert.equal((init?.headers as Record<string, string>).Authorization, undefined);
    return new Response(JSON.stringify({
      message: { content: 'local answer' },
      prompt_eval_count: 10,
      eval_count: 5,
      model: 'qwen2.5-coder:7b',
    }), { status: 200 });
  }) as typeof fetch;

  const response = await callOllama(config(), [{ role: 'user', content: 'hello' }], {}, fakeFetch);
  assert.equal(response.content, 'local answer');
  assert.equal(response.tokensUsed, 15);
  assert.equal(response.provider, 'ollama');
  assert.equal(requested, 'http://127.0.0.1:11434/api/chat');
});

test('Ollama rejects embedding models before making a request', async () => {
  let called = false;
  const fakeFetch = (async () => {
    called = true;
    return new Response('{}');
  }) as typeof fetch;

  await assert.rejects(
    callOllama(config({ model: 'nomic-embed-text' }), [{ role: 'user', content: 'x' }], {}, fakeFetch),
    (err: unknown) => err instanceof HageezError && err.code === 'MODEL_NOT_CHAT'
  );
  assert.equal(called, false);
});

test('Ollama maps missing models and stopped servers to actionable errors', async () => {
  const missing = (async () => new Response('{}', { status: 404 })) as typeof fetch;
  await assert.rejects(
    callOllama(config(), [{ role: 'user', content: 'x' }], {}, missing),
    (err: unknown) =>
      err instanceof HageezError &&
      err.code === 'MODEL_NOT_FOUND' &&
      /ollama pull/.test(err.message)
  );

  const stopped = (async () => { throw new TypeError('fetch failed'); }) as typeof fetch;
  await assert.rejects(
    callOllama(config(), [{ role: 'user', content: 'x' }], {}, stopped),
    (err: unknown) =>
      err instanceof HageezError &&
      err.code === 'PROVIDER_UNREACHABLE' &&
      /ollama serve/.test(err.message)
  );
});

test('Ollama maps aborts to TIMEOUT', async () => {
  const aborted = (async () => {
    const err = new Error('aborted');
    err.name = 'AbortError';
    throw err;
  }) as typeof fetch;
  await assert.rejects(
    callOllama(config({ timeoutMs: 5 }), [{ role: 'user', content: 'x' }], {}, aborted),
    (err: unknown) => err instanceof HageezError && err.code === 'TIMEOUT'
  );
});
