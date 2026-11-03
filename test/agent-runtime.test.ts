import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { buildDefaultConfig } from '../src/core/config';
import { HageezConfig, LLMMessage, LLMResponse } from '../src/core/types';
import { AGENTS, AGENT_IDS } from '../src/agents/registry';
import { runAgent, buildAgentSystemPrompt } from '../src/agents/runtime';
import { rememberDecision } from '../src/memory';
import { addSkill } from '../src/skills';

function tempProject(t: { after: (fn: () => void) => void }): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hageezai-agent-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function config(overrides: Partial<HageezConfig> = {}): HageezConfig {
  return {
    ...buildDefaultConfig('openai', 'sk-test'),
    ...overrides,
  };
}

test('every agent definition carries its contract', () => {
  assert.equal(AGENT_IDS.length, 10);
  for (const id of AGENT_IDS) {
    const agent = AGENTS[id];
    assert.equal(agent.name, id);
    assert.ok(agent.role.length > 0);
    assert.ok(agent.systemPrompt.length > 0);
    assert.ok(agent.inputs.length > 0);
    assert.ok(agent.outputs.length > 0);
    assert.ok(Array.isArray(agent.allowedTools));
  }
});

test('runAgent uses the default model and returns a structured result', async () => {
  let captured: LLMMessage[] = [];
  let referenceSeen: unknown;
  const result = await runAgent('analyst', {
    config: config(),
    task: 'Add pagination',
    projectPath: '/tmp/example',
    call: async (_config, messages, _options, reference) => {
      captured = messages;
      referenceSeen = reference;
      return {
        content: 'analysis output',
        tokensUsed: 12,
        model: 'gpt-4o',
        provider: 'openai',
        durationMs: 5,
      };
    },
  });

  assert.equal(result.status, 'success');
  assert.equal(result.agent, 'analyst');
  assert.equal(result.output, 'analysis output');
  assert.equal(result.tokens, 12);
  assert.deepEqual(result.artifacts, ['analysis']);
  assert.equal(result.connection, 'openai');
  assert.equal(result.model, 'gpt-4o');
  assert.deepEqual(referenceSeen, { connection: 'openai', model: 'gpt-4o' });
  assert.match(captured[0].content, /Add pagination/);
});

test('runAgent returns a failed result instead of throwing', async () => {
  const result = await runAgent('build', {
    config: config(),
    task: 'x',
    call: async () => { throw new Error('provider down'); },
  });
  assert.equal(result.status, 'failed');
  assert.equal(result.tokens, 0);
  assert.match(result.error ?? '', /provider down/);
});

test('agent prompts include Decisions and matching Skills only', async (t) => {
  const project = tempProject(t);
  await rememberDecision('stack', 'Use TypeScript strict mode', project);
  addSkill('strict-tests', 'Always add tests.', { agents: ['analyst'] }, project);

  const analystPrompt = buildAgentSystemPrompt('analyst', 'task', project);
  const pmPrompt = buildAgentSystemPrompt('pm', 'task', project);
  assert.match(analystPrompt, /Use TypeScript strict mode/);
  assert.match(analystPrompt, /Always add tests/);
  assert.match(pmPrompt, /Use TypeScript strict mode/);
  assert.equal(pmPrompt.includes('Always add tests'), false);
});

test('runAgent forwards upstream artifacts as inputs, not chat history', async () => {
  let prompt = '';
  await runAgent('pm', {
    config: config(),
    task: 'plan it',
    inputs: { analysis: 'requirements from analyst' },
    call: async (_config, messages) => {
      prompt = messages[0].content;
      return { content: 'plan', tokensUsed: 1, model: 'm', provider: 'openai', durationMs: 1 } as LLMResponse;
    },
  });
  assert.match(prompt, /Upstream Artifacts/);
  assert.match(prompt, /requirements from analyst/);
});
