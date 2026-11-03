import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  agentModelReference,
  agentUsageCount,
  catalogForConnection,
  connectionConcurrency,
  connectionTimeout,
  isEmbeddingModel,
  resolveAgentConfig,
  resolveApiKey,
  resolveBaseUrl,
  resolveModelConfig,
} from '../src/core/llm/registry';
import { classifyModel, probeConnection } from '../src/core/llm/connections';
import { HageezConfig } from '../src/core/types';

function config(overrides: Partial<HageezConfig> = {}): HageezConfig {
  return {
    maxTokens: 100,
    temperature: 0.2,
    memoryEnabled: true,
    ragEnabled: true,
    telemetryEnabled: false,
    version: 2,
    connections: {
      cloud: { type: 'groq', apiKey: 'cloud-key', maxConcurrent: 2 },
      local: { type: 'ollama', baseUrl: 'http://localhost:11434' },
      compatible: { type: 'openai-compatible', apiKeyEnv: 'COMPATIBLE_KEY', baseUrl: 'http://localhost:9999/v1' },
    },
    defaultModel: { connection: 'cloud', model: 'llama-3.3-70b-versatile' },
    agents: {
      build: { connection: 'local', model: 'qwen2.5-coder:7b' },
    },
    ...overrides,
  };
}

test('registry resolves defaults, agent assignments, and model overrides', () => {
  const cfg = config();
  assert.deepEqual(agentModelReference(cfg, 'build'), { connection: 'local', model: 'qwen2.5-coder:7b' });
  assert.deepEqual(agentModelReference(cfg, 'analyst'), { connection: 'cloud', model: 'llama-3.3-70b-versatile' });
  const resolved = resolveAgentConfig(cfg, 'build');
  assert.equal(resolved.provider, 'ollama');
  assert.equal(resolved.model, 'qwen2.5-coder:7b');
  assert.equal(resolved.timeoutMs, 300000);
  assert.equal(resolved.maxConcurrent, 1);
  assert.equal(resolved.baseUrl, 'http://localhost:11434');
});

test('registry keeps cloud timeout and concurrency defaults', () => {
  const cfg = config();
  const resolved = resolveModelConfig(cfg, { connection: 'cloud', model: 'x' });
  assert.equal(resolved.timeoutMs, 60000);
  assert.equal(resolved.maxConcurrent, 2);
  assert.equal(connectionConcurrency(cfg, 'compatible'), 3);
});

test('registry resolves environment keys and base URLs', () => {
  const previous = process.env.COMPATIBLE_KEY;
  process.env.COMPATIBLE_KEY = 'env-secret';
  try {
    const cfg = config();
    assert.equal(resolveApiKey(cfg, 'compatible'), 'env-secret');
    assert.equal(resolveBaseUrl(cfg, 'compatible'), 'http://localhost:9999/v1');
    assert.equal(resolveBaseUrl(cfg, 'cloud'), 'https://api.groq.com/openai/v1');
    assert.equal(agentUsageCount(cfg, 'local'), 1);
  } finally {
    if (previous === undefined) delete process.env.COMPATIBLE_KEY;
    else process.env.COMPATIBLE_KEY = previous;
  }
});

test('catalog uses overrides and classifies embedding names', () => {
  const cfg = config({
    connections: {
      cloud: { type: 'groq', models: ['custom-model'] },
    },
  });
  assert.deepEqual(catalogForConnection(cfg, 'cloud'), ['custom-model']);
  assert.equal(isEmbeddingModel('nomic-embed-text'), true);
  assert.equal(isEmbeddingModel('llama3.2:3b'), false);
  assert.equal(classifyModel('mxbai-embed-large'), 'embedding');
  assert.equal(classifyModel('qwen2.5-coder'), 'chat');
  assert.equal(classifyModel('unknown', { capabilities: ['embedding'] }), 'embedding');
});

test('probeConnection lists cloud models and maps auth failures', async () => {
  const cfg = config();
  const fakeFetch = (async (url: string | URL | Request) => {
    assert.match(String(url), /\/models$/);
    return new Response(JSON.stringify({ data: [{ id: 'model-a' }, { id: 'model-b' }] }), { status: 200 });
  }) as typeof fetch;
  const ok = await probeConnection(cfg, 'cloud', { fetchImpl: fakeFetch, timeoutMs: 100 });
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.models.map((model: { name: string }) => model.name), ['model-a', 'model-b']);

  const denied = (async () => new Response('{}', { status: 401 })) as typeof fetch;
  const failed = await probeConnection(cfg, 'cloud', { fetchImpl: denied, timeoutMs: 100 });
  assert.equal(failed.ok, false);
  assert.equal(failed.code, 'AUTH');
});

test('probeConnection classifies Ollama models and gives a serve hint', async () => {
  const cfg = config();
  const fakeFetch = (async () => new Response(JSON.stringify({
    models: [
      { name: 'llama3.2:3b', details: { family: 'llama' } },
      { name: 'nomic-embed-text', details: { family: 'nomic-bert' } },
    ],
  }), { status: 200 })) as typeof fetch;
  const ok = await probeConnection(cfg, 'local', { fetchImpl: fakeFetch, timeoutMs: 100 });
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.models, [
    { name: 'llama3.2:3b', kind: 'chat' },
    { name: 'nomic-embed-text', kind: 'embedding' },
  ]);

  const unreachable = (async () => { throw new TypeError('fetch failed'); }) as typeof fetch;
  const failed = await probeConnection(cfg, 'local', { fetchImpl: unreachable, timeoutMs: 100 });
  assert.equal(failed.ok, false);
  assert.equal(failed.code, 'PROVIDER_UNREACHABLE');
  assert.match(failed.error ?? '', /ollama serve/);
});
