import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { buildDefaultConfig, loadConfig, saveConfig } from '../src/core/config';
import { HageezConfig, HageezError } from '../src/core/types';
import {
  assertConnectionsReady,
  applyPreset,
  assignAgent,
  parseAgentModel,
  presetReferences,
  printAgentTable,
  resolveAgentReference,
} from '../src/agents/assignment';
import { AGENT_IDS as REGISTRY_IDS } from '../src/agents/registry';

function setupHome(t: { after: (fn: () => void) => void }): void {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'hageezai-assign-'));
  const previous = process.env.HOME;
  process.env.HOME = home;
  t.after(() => {
    if (previous === undefined) delete process.env.HOME;
    else process.env.HOME = previous;
    fs.rmSync(home, { recursive: true, force: true });
  });
}

function config(): HageezConfig {
  return {
    ...buildDefaultConfig('groq', 'cloud-key'),
    connections: {
      cloud: { type: 'groq', apiKey: 'cloud-key' },
      local: { type: 'ollama', models: ['qwen2.5-coder:7b'] },
    },
    defaultModel: { connection: 'cloud', model: 'llama-3.3-70b-versatile' },
  };
}

test('registry contains exactly the ten agents', () => {
  assert.deepEqual([...REGISTRY_IDS], [
    'analyst', 'product-brief', 'pm', 'ux-designer', 'architect',
    'project-context', 'build', 'code-review', 'qa-tests', 'retrospective',
  ]);
  assert.equal(REGISTRY_IDS.length, 10);
});

test('resolution order is override, assignment, then default', () => {
  const cfg = config();
  cfg.agents.build = { connection: 'local', model: 'qwen2.5-coder:7b' };
  assert.deepEqual(resolveAgentReference(cfg, 'build'), { connection: 'local', model: 'qwen2.5-coder:7b' });
  assert.deepEqual(
    resolveAgentReference(cfg, 'build', { connection: 'cloud', model: 'override' }),
    { connection: 'cloud', model: 'override' }
  );
  assert.deepEqual(resolveAgentReference(cfg, 'analyst'), cfg.defaultModel);
});

test('mixed preset puts four light agents local and six heavy agents cloud', () => {
  const refs = presetReferences(config(), 'mixed');
  for (const agent of ['analyst', 'product-brief', 'pm', 'retrospective'] as const) {
    assert.equal(refs[agent].connection, 'local');
  }
  for (const agent of ['ux-designer', 'architect', 'project-context', 'build', 'code-review', 'qa-tests'] as const) {
    assert.equal(refs[agent].connection, 'cloud');
  }
});

test('assign refuses embedding models and warns for weak heavy-agent models', (t) => {
  setupHome(t);
  saveConfig(config());
  const cfg = loadConfig();
  assert.throws(
    () => assignAgent(cfg, 'build', { connection: 'local', model: 'nomic-embed-text' }),
    (err: unknown) => err instanceof HageezError && err.code === 'MODEL_NOT_CHAT'
  );
  const warnings = assignAgent(cfg, 'architect', { connection: 'local', model: 'qwen2.5:3b' });
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /3B parameters or fewer/);
});

test('assignment table shows all ten rows and the connections in use', () => {
  const output: string[] = [];
  const original = console.log;
  console.log = (...args: unknown[]) => output.push(args.join(' '));
  try {
    printAgentTable(config());
  } finally {
    console.log = original;
  }
  for (const agent of REGISTRY_IDS) assert.match(output.join('\n'), new RegExp(agent));
  assert.match(output.join('\n'), /Connections in use: cloud/);
});

test('missing keys and unreachable connections fail before a run', async () => {
  const cfg = config();
  cfg.connections.cloud = { type: 'groq', apiKeyEnv: 'MISSING_KEY_FOR_TEST' };
  delete process.env.MISSING_KEY_FOR_TEST;
  await assert.rejects(
    assertConnectionsReady(cfg, ['analyst']),
    (err: unknown) => err instanceof HageezError && err.code === 'AGENT_MODEL_UNAVAILABLE'
  );

  const unreachable = (async () => { throw new TypeError('fetch failed'); }) as typeof fetch;
  await assert.rejects(
    assertConnectionsReady(cfg, ['analyst'], { probe: true, fetchImpl: unreachable }),
    (err: unknown) => err instanceof HageezError && err.code === 'AGENT_MODEL_UNAVAILABLE'
  );
});

test('parseAgentModel accepts connection:model', () => {
  assert.deepEqual(parseAgentModel('groq:llama-3.3-70b-versatile'), {
    connection: 'groq',
    model: 'llama-3.3-70b-versatile',
  });
  assert.deepEqual(parseAgentModel('ollama:llama3.2:3b'), {
    connection: 'ollama',
    model: 'llama3.2:3b',
  });
  assert.throws(() => parseAgentModel('nope'), HageezError);
});
