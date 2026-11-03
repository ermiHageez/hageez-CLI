import { test } from 'node:test';
import assert from 'node:assert/strict';
import { callOpenAI } from '../src/core/llm/openai';
import { callAnthropic } from '../src/core/llm/anthropic';
import { mapProviderError, type ProviderTransport } from '../src/core/llm/provider';
import { buildDefaultConfig } from '../src/core/config';
import { resolveModelConfig } from '../src/core/llm/registry';
import { HageezError, type LLMMessage } from '../src/core/types';

const messages: LLMMessage[] = [{ role: 'user', content: 'hello' }];
const config = resolveModelConfig(buildDefaultConfig('openai', 'sk-secret'));

test('401 maps to AUTH without retrying or leaking the key', async () => {
  let calls = 0;
  const transport: ProviderTransport = {
    create: async () => {
      calls += 1;
      throw { status: 401, message: 'bad key sk-secret' };
    },
  };

  await assert.rejects(
    callOpenAI(config, messages, {}, transport),
    (error: unknown) =>
      error instanceof HageezError &&
      error.code === 'AUTH' &&
      !error.message.includes('sk-secret')
  );
  assert.equal(calls, 1);
});

test('429 retries and returns the successful response with token usage', async () => {
  let calls = 0;
  const transport: ProviderTransport = {
    create: async () => {
      calls += 1;
      if (calls === 1) throw { status: 429 };
      return {
        choices: [{ message: { content: 'ok' } }],
        usage: { total_tokens: 4 },
        model: 'fake-model',
      };
    },
  };

  const result = await callOpenAI(config, messages, {}, transport);

  assert.equal(calls, 2);
  assert.equal(result.content, 'ok');
  assert.equal(result.tokensUsed, 4);
});

test('5xx retries three times and then maps to PROVIDER', async () => {
  let calls = 0;
  const transport: ProviderTransport = {
    create: async () => {
      calls += 1;
      throw { status: 500 };
    },
  };

  await assert.rejects(
    callOpenAI(config, messages, {}, transport),
    (error: unknown) => error instanceof HageezError && error.code === 'PROVIDER'
  );
  assert.equal(calls, 3);
});

test('connection timeouts retry three times and then map to TIMEOUT', async () => {
  let calls = 0;
  const transport: ProviderTransport = {
    create: async () => {
      calls += 1;
      throw { code: 'ETIMEDOUT' };
    },
  };

  await assert.rejects(
    callOpenAI(config, messages, {}, transport),
    (error: unknown) => error instanceof HageezError && error.code === 'TIMEOUT'
  );
  assert.equal(calls, 3);
});

test('an aborted signal fails before calling the transport', async () => {
  let calls = 0;
  const controller = new AbortController();
  controller.abort();
  const transport: ProviderTransport = {
    create: async () => {
      calls += 1;
      return { choices: [{ message: { content: 'never' } }] };
    },
  };

  await assert.rejects(
    callOpenAI(config, messages, { signal: controller.signal }, transport),
    (error: unknown) => error instanceof HageezError && error.code === 'TIMEOUT'
  );
  assert.equal(calls, 0);
});

test('uses the configured timeout, defaulting to 60 seconds', async () => {
  const seen: Array<number | undefined> = [];
  const transport: ProviderTransport = {
    create: async (_params, options) => {
      seen.push(options?.timeout);
      return {
        choices: [{ message: { content: 'ok' } }],
        usage: { total_tokens: 1 },
        model: 'fake-model',
      };
    },
  };

  await callOpenAI(config, messages, {}, transport);
  await callOpenAI({ ...config, timeoutMs: 1234 }, messages, {}, transport);

  assert.deepEqual(seen, [60000, 1234]);
});

test('fallback timeout applies to older config objects without timeoutMs', async () => {
  const { timeoutMs, ...oldConfig } = config;
  const seen: Array<number | undefined> = [];
  const transport: ProviderTransport = {
    create: async (_params, options) => {
      seen.push(options?.timeout);
      return {
        choices: [{ message: { content: 'ok' } }],
        usage: { total_tokens: 1 },
        model: 'fake-model',
      };
    },
  };

  await callOpenAI(oldConfig, messages, {}, transport);

  assert.deepEqual(seen, [60000]);
});

test('Anthropic receives temperature and returns reported token usage', async () => {
  let params: Record<string, unknown> | undefined;
  const transport: ProviderTransport = {
    create: async (value) => {
      params = value as Record<string, unknown>;
      return {
        content: [{ type: 'text', text: 'anthropic ok' }],
        usage: { input_tokens: 2, output_tokens: 3 },
        model: 'claude-fake',
      };
    },
  };

  const anthropicConfig = resolveModelConfig(buildDefaultConfig('anthropic', 'sk-ant-secret'));
  const result = await callAnthropic(anthropicConfig, messages, {}, transport);

  assert.equal(params?.temperature, anthropicConfig.temperature);
  assert.equal(result.content, 'anthropic ok');
  assert.equal(result.tokensUsed, 5);
});

test('maps rate limits and server failures to stable codes', () => {
  assert.equal(mapProviderError('openai', { status: 429 }).code, 'RATE_LIMIT');
  assert.equal(mapProviderError('openai', { status: 503 }).code, 'PROVIDER');
  assert.equal(mapProviderError('openai', { name: 'AbortError' }).code, 'TIMEOUT');
});
