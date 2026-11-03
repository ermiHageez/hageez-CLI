import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { buildDefaultConfig, HageezConfig, LLMMessage } from '../src/core';
import { runFinalPipeline, FINAL_PIPELINE } from '../src/pipeline';
import {
  detectTestCommand,
  extractTestFiles,
  highSeverityIssues,
  runBuildAgent,
  runCodeReviewAgent,
  runQaAgent,
  runRetrospectiveAgent,
  uxTriggered,
} from '../src/pipeline/agents';
import { readManifest, readArtifact } from '../src/artifacts';
import { recallDecisions } from '../src/memory';
import { scanProject } from '../src/filesystem';

function tempProject(t: { after: (fn: () => void) => void }): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hageezai-pipeline-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ scripts: { test: 'true' } }));
  fs.mkdirSync(path.join(root, 'src'));
  fs.writeFileSync(path.join(root, 'src', 'index.ts'), 'export const value = 1;\n');
  return root;
}

const agentCall = async () => ({
  content: '# Upstream\n\nA concise artifact for the next agent.',
  tokensUsed: 2,
  model: 'fake-model',
});

const builderCall = async () => ({
  content: '```ts\nexport const generated = true;\n```',
  tokensUsed: 3,
  model: 'fake-model',
});

const reviewerCall = async () => ({
  content: 'No blocking issues.',
  tokensUsed: 1,
  model: 'fake-model',
});

test('the final graph has the ten agents and a single writer', () => {
  assert.deepEqual(
    FINAL_PIPELINE.nodes.map((node) => node.agent).sort(),
    [
      'analyst', 'architect', 'build', 'code-review', 'pm', 'product-brief',
      'project-context', 'qa-tests', 'retrospective', 'ux-designer',
    ].sort()
  );
  const writers = FINAL_PIPELINE.nodes.filter((node) => node.agent === 'build');
  assert.equal(writers.length, 1);
});

test('a full dry-run traverses the graph without project or learning writes', async (t) => {
  const root = tempProject(t);
  const result = await runFinalPipeline({
    config: buildDefaultConfig('openai', 'sk-test'),
    task: 'add a generated module',
    projectPath: root,
    dryRun: true,
    call: agentCall as never,
    builderCall: builderCall as never,
    reviewerCall: reviewerCall as never,
    runTests: async () => ({ code: 0, stdout: 'ok', stderr: '' }),
  });
  assert.equal(result.nodes.filter((node) => node.status === 'failed').length, 0);
  assert.equal(result.nodes.find((node) => node.node.agent === 'retrospective')?.status, 'skipped');
  assert.equal(fs.existsSync(path.join(root, 'ai-learning')), false);
  assert.equal(fs.existsSync(path.join(root, 'add_a_generated_module.ts')), false);
});

test('a full run writes artifacts, applies approved code, runs tests, and records a Decision', async (t) => {
  const root = tempProject(t);
  const result = await runFinalPipeline({
    config: buildDefaultConfig('openai', 'sk-test'),
    task: 'add a generated module',
    projectPath: root,
    yes: true,
    call: agentCall as never,
    builderCall: builderCall as never,
    reviewerCall: reviewerCall as never,
    runTests: async () => ({ code: 0, stdout: 'ok', stderr: '' }),
  });
  assert.equal(result.nodes.filter((node) => node.status === 'failed').length, 0);
  assert.equal(fs.existsSync(path.join(root, 'add_a_generated_module.ts')), true);
  const manifest = readManifest(result.runId, root);
  assert.ok(manifest.artifacts.some((artifact) => artifact.agent === 'retrospective'));
  assert.equal(manifest.artifacts.find((artifact) => artifact.agent === 'ux-designer')?.status, 'skipped');
  assert.match(readArtifact(result.runId, 'qa-tests', root), /Status: pass/);
  assert.ok(recallDecisions(root, `retro-${result.runId}`).length > 0);

  const prompts: string[] = [];
  await runFinalPipeline({
    config: buildDefaultConfig('openai', 'sk-test'),
    task: 'follow-up task',
    projectPath: root,
    dryRun: true,
    call: (async (_config: HageezConfig, messages: LLMMessage[]) => {
      prompts.push(messages[0].content);
      return { content: '# Upstream', tokensUsed: 1, model: 'fake-model' };
    }) as never,
    builderCall: builderCall as never,
    reviewerCall: reviewerCall as never,
    runTests: async () => ({ code: 0, stdout: 'ok', stderr: '' }),
  });
  assert.ok(prompts.some((prompt) => prompt.includes(`retro-${result.runId}`)));
});

test('high-severity review issues are parsed for the rebuild loop', () => {
  assert.equal(highSeverityIssues({
    agent: 'code-review', status: 'success', artifacts: [], tokens: 0, model: '', connection: '', durationMs: 0,
    output: '```json\n[{"severity":"high"},{"severity":"low"}]\n```',
  }), 1);
});

test('review includes an untracked new file in the actual diff', async (t) => {
  const root = tempProject(t);
  execFileSync('git', ['init'], { cwd: root });
  fs.writeFileSync(path.join(root, 'new-file.ts'), 'export const untracked = true;\n');
  let captured = '';
  const result = await runCodeReviewAgent({
    config: buildDefaultConfig('openai', 'sk-test'),
    task: 'review',
    projectPath: root,
    reviewerCall: (async (_config: HageezConfig, messages: LLMMessage[]) => {
      captured = messages[1].content;
      return { content: 'ok', tokensUsed: 1, model: 'fake-model', issues: [] };
    }) as never,
  });
  assert.equal(result.status, 'success');
  assert.match(captured, /new-file\.ts/);
  assert.match(captured, /untracked = true/);
});

test('QA detects the project test command and retrospective writes recallable memory', async (t) => {
  const root = tempProject(t);
  assert.deepEqual(detectTestCommand(root), { command: 'npm', args: ['test'] });
  const retro = await runRetrospectiveAgent({
    config: buildDefaultConfig('openai', 'sk-test'),
    task: 'task',
    projectPath: root,
    runId: 'run-1',
    manifest: {
      runId: 'run-1', task: 'task', projectPath: root, startedAt: new Date().toISOString(),
      status: 'success', artifacts: [],
    },
  });
  assert.equal(retro.status, 'success');
  assert.ok(recallDecisions(root, 'run-1').length > 0);
});

test('UX triggers only for frontend frameworks or UI tasks', async () => {
  const project = await scanProject(tempProject({ after: () => undefined }));
  assert.equal(uxTriggered(project, 'add a CLI command'), false);
  assert.equal(uxTriggered(project, 'build a responsive settings screen'), true);
});


test('QA extracts generated test files and writes them only through approval', async (t) => {
  const root = tempProject(t);
  assert.deepEqual(extractTestFiles('### tests/generated.test.ts\n```ts\ntest("x", () => {});\n```'), [
    { path: 'tests/generated.test.ts', content: 'test("x", () => {});\n' },
  ]);
  const result = await runQaAgent({
    config: buildDefaultConfig('openai', 'sk-test'),
    task: 'add tests',
    projectPath: root,
    yes: true,
    call: (async () => ({
      content: '### tests/generated.test.ts\n```ts\ntest("x", () => {});\n```',
      tokensUsed: 1,
      model: 'fake-model',
    })) as never,
    runTests: async () => ({ code: 0, stdout: 'ok', stderr: '' }),
  });
  assert.equal(result.status, 'success');
  assert.equal(fs.existsSync(path.join(root, 'tests', 'generated.test.ts')), true);
  assert.match(result.output, /Test files written: 1/);
});

test('the review loop rebuilds at most twice when high issues persist', async (t) => {
  const root = tempProject(t);
  let builds = 0;
  const result = await runFinalPipeline({
    config: buildDefaultConfig('openai', 'sk-test'),
    task: 'add a generated module',
    projectPath: root,
    yes: true,
    call: agentCall as never,
    builderCall: (async () => {
      builds += 1;
      return { content: '```ts\nexport const generated = true;\n```', tokensUsed: 1, model: 'fake-model' };
    }) as never,
    reviewerCall: (async () => ({
      content: '[ERROR] blocking issue',
      tokensUsed: 1,
      model: 'fake-model',
      issues: [{ severity: 'error', message: 'blocking issue' }],
    })) as never,
    runTests: async () => ({ code: 0, stdout: 'ok', stderr: '' }),
  });
  assert.equal(builds, 3);
  assert.ok(result.nodes.some((node) => node.node.agent === 'code-review' && node.status === 'success'));
});


test('a clean review finishes without an extra Build pass', async (t) => {
  const root = tempProject(t);
  let builds = 0;
  await runFinalPipeline({
    config: buildDefaultConfig('openai', 'sk-test'),
    task: 'add a generated module',
    projectPath: root,
    yes: true,
    call: agentCall as never,
    builderCall: (async () => {
      builds += 1;
      return { content: '```ts\nexport const generated = true;\n```', tokensUsed: 1, model: 'fake-model' };
    }) as never,
    reviewerCall: reviewerCall as never,
    runTests: async () => ({ code: 0, stdout: 'ok', stderr: '' }),
  });
  assert.equal(builds, 1);
});

test('QA reports failures and missing test commands instead of passing', async (t) => {
  const root = tempProject(t);
  const failed = await runQaAgent({
    config: buildDefaultConfig('openai', 'sk-test'),
    task: 'add tests',
    projectPath: root,
    call: agentCall as never,
    runTests: async () => ({ code: 1, stdout: 'boom', stderr: 'stack' }),
  });
  assert.equal(failed.status, 'failed');
  assert.match(failed.output, /Status: fail/);

  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'hageezai-no-tests-'));
  t.after(() => fs.rmSync(empty, { recursive: true, force: true }));
  const missing = await runQaAgent({
    config: buildDefaultConfig('openai', 'sk-test'),
    task: 'add tests',
    projectPath: empty,
    call: agentCall as never,
    runTests: async () => ({ code: 0, stdout: 'ok', stderr: '' }),
  });
  assert.equal(missing.status, 'failed');
  assert.match(missing.error ?? '', /No test command detected/);
});

test('product brief and architect artifacts carry their required structure', async (t) => {
  const root = tempProject(t);
  const prompts: string[] = [];
  const brief = await runFinalPipeline({
    config: buildDefaultConfig('openai', 'sk-test'),
    task: 'design a small feature',
    projectPath: root,
    dryRun: true,
    call: (async (_config: HageezConfig, messages: LLMMessage[]) => {
      prompts.push(messages[0].content);
      return { content: '# Brief\n\nProblem, users, outcomes, constraints, non-goals.', tokensUsed: 1, model: 'fake-model' };
    }) as never,
    builderCall: builderCall as never,
    reviewerCall: reviewerCall as never,
    runTests: async () => ({ code: 0, stdout: 'ok', stderr: '' }),
  });
  assert.ok(prompts.some((prompt) => /Socratic/i.test(prompt)));
  const design = brief.nodes.find((node) => node.node.agent === 'architect')?.result?.output ?? '';
  assert.match(design, /Draft ADRs/i);
  const context = brief.nodes.find((node) => node.node.agent === 'project-context')?.result?.output ?? '';
  assert.match(context, /Conflicts/);
});


test('the Build agent respects a rejected change and writes nothing', async (t) => {
  const root = tempProject(t);
  const result = await runBuildAgent({
    config: buildDefaultConfig('openai', 'sk-test'),
    task: 'add a generated module',
    projectPath: root,
    builderCall: builderCall as never,
    ask: async () => 'n',
    isTTY: true,
  });
  assert.equal(result.status, 'success');
  assert.equal(fs.existsSync(path.join(root, 'add_a_generated_module.ts')), false);
  assert.match(result.output, /Rejected: 1/);
});
