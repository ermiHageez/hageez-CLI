import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { buildDefaultConfig } from '../src/core/config';
import { HageezConfig } from '../src/core/types';
import { canWriteProject, PipelineDefinition, runPipeline, validatePipeline } from '../src/orchestrator';
import { AgentRunResult } from '../src/agents/types';

function tempProject(t: { after: (fn: () => void) => void }): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hageezai-orchestrator-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function config(overrides: Partial<HageezConfig> = {}): HageezConfig {
  return { ...buildDefaultConfig('openai', 'sk-test'), ...overrides };
}

function result(agent: string, output = `${agent} output`): AgentRunResult {
  return {
    agent,
    status: 'success',
    output,
    artifacts: [],
    tokens: 1,
    model: 'gpt-4o',
    connection: 'openai',
    durationMs: 1,
  };
}

const graph: PipelineDefinition = {
  name: 'test',
  nodes: [
    { id: 'a', agent: 'analyst', dependsOn: [] },
    { id: 'b', agent: 'pm', dependsOn: ['a'] },
    { id: 'c', agent: 'ux-designer', dependsOn: ['a'], optional: true },
    { id: 'd', agent: 'architect', dependsOn: ['b', 'c'] },
  ],
};

test('cycles and unknown dependencies are rejected before execution', () => {
  assert.throws(
    () => validatePipeline({ name: 'cycle', nodes: [
      { id: 'a', agent: 'analyst', dependsOn: ['b'] },
      { id: 'b', agent: 'pm', dependsOn: ['a'] },
    ] }),
    /cycle/i
  );
  assert.throws(
    () => validatePipeline({ name: 'missing', nodes: [
      { id: 'a', agent: 'analyst', dependsOn: ['nope'] },
    ] }),
    /unknown node/i
  );
});

test('independent branches run in parallel and the join waits for both', async (t) => {
  const project = tempProject(t);
  let releaseB: () => void = () => {};
  let releaseC: () => void = () => {};
  const bGate = new Promise<void>((resolve) => { releaseB = resolve; });
  const cGate = new Promise<void>((resolve) => { releaseC = resolve; });
  const started: string[] = [];
  const finished: string[] = [];

  const run = runPipeline(graph, {
    config: config(),
    task: 'build',
    projectPath: project,
    dryRun: true,
    execute: async (node) => {
      started.push(node.id);
      if (node.id === 'b') await bGate;
      if (node.id === 'c') await cGate;
      finished.push(node.id);
      return result(node.agent);
    },
  });

  const waitFor = async (condition: () => boolean): Promise<void> => {
    for (let i = 0; i < 100 && !condition(); i++) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  };
  await waitFor(() => started.includes('b') && started.includes('c'));
  assert.equal(started.includes('d'), false);
  assert.ok(started.includes('b') && started.includes('c'));
  releaseB();
  releaseC();
  const output = await run;
  assert.ok(finished.indexOf('b') < finished.indexOf('d'));
  assert.ok(finished.indexOf('c') < finished.indexOf('d'));
  assert.deepEqual(output.nodes.map((node) => node.status), ['success', 'success', 'success', 'success']);
});

test('a failed node skips dependents while independent branches continue', async (t) => {
  const project = tempProject(t);
  const output = await runPipeline(graph, {
    config: config(),
    task: 'build',
    projectPath: project,
    dryRun: true,
    execute: async (node) => {
      if (node.id === 'b') throw new Error('pm failed');
      return result(node.agent);
    },
  });
  const states = Object.fromEntries(output.nodes.map((node) => [node.node.id, node.status]));
  assert.equal(states.a, 'success');
  assert.equal(states.b, 'failed');
  assert.equal(states.c, 'success');
  assert.equal(states.d, 'skipped');
});

test('a single-slot Ollama connection serializes agents', async (t) => {
  const project = tempProject(t);
  const cfg = config({
    connections: { local: { type: 'ollama', maxConcurrent: 1 } },
    defaultModel: { connection: 'local', model: 'llama3.2:3b' },
    agents: {
      analyst: { connection: 'local', model: 'llama3.2:3b' },
      pm: { connection: 'local', model: 'llama3.2:3b' },
    },
  });
  let active = 0;
  let maxActive = 0;
  const output = await runPipeline({
    name: 'local',
    nodes: [
      { id: 'a', agent: 'analyst', dependsOn: [] },
      { id: 'b', agent: 'pm', dependsOn: [] },
    ],
  }, {
    config: cfg,
    task: 'task',
    projectPath: project,
    dryRun: true,
    execute: async (node) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 15));
      active -= 1;
      return result(node.agent);
    },
  });
  assert.equal(maxActive, 1);
  assert.ok(output.nodes.every((node) => node.status === 'success'));
});

test('only the build agent may write project files', async (t) => {
  const project = tempProject(t);
  const seen: Record<string, boolean> = {};
  await runPipeline({
    name: 'writers',
    nodes: [
      { id: 'a', agent: 'analyst', dependsOn: [] },
      { id: 'b', agent: 'build', dependsOn: ['a'] },
    ],
  }, {
    config: config(),
    task: 'task',
    projectPath: project,
    dryRun: true,
    execute: async (node, context) => {
      seen[node.agent] = context.canWriteProject;
      return result(node.agent);
    },
  });
  assert.equal(seen.analyst, false);
  assert.equal(seen.build, true);
  assert.equal(canWriteProject('build'), true);
  assert.equal(canWriteProject('analyst'), false);
});

test('a real run writes artifacts and the manifest under ai-learning/runs', async (t) => {
  const project = tempProject(t);
  const output = await runPipeline({
    name: 'artifacts',
    nodes: [
      { id: 'a', agent: 'analyst', dependsOn: [] },
      { id: 'b', agent: 'pm', dependsOn: ['a'] },
    ],
  }, {
    config: config(),
    task: 'task',
    projectPath: project,
    execute: async (node) => result(node.agent, `${node.agent} body`),
  });
  assert.equal(output.manifest?.status, 'success');
  const runDir = path.join(project, 'ai-learning', 'runs', output.runId);
  assert.equal(fs.readFileSync(path.join(runDir, 'analyst.md'), 'utf-8'), 'analyst body');
  assert.equal(fs.readFileSync(path.join(runDir, 'pm.md'), 'utf-8'), 'pm body');
  const manifest = JSON.parse(fs.readFileSync(path.join(runDir, 'run.json'), 'utf-8'));
  assert.deepEqual(manifest.artifacts.map((item: { agent: string }) => item.agent).sort(), ['analyst', 'pm']);
  assert.deepEqual(manifest.artifacts.find((item: { agent: string }) => item.agent === 'pm').inputs, ['analyst']);
});
