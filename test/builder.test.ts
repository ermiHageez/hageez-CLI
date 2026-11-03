import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createBuilder, type BuilderModelCall } from '../src/builder';
import { buildDefaultConfig } from '../src/core/config';
import { HageezError, type LLMResponse, type ProjectContext } from '../src/core/types';
import { buildFileContext, type FileReference } from '../src/ui/filerefs';

function makeProject(t: { after: (fn: () => void) => void }, language: string | null): ProjectContext {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hageezai-builder-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return {
    path: root,
    name: 'fixture',
    language,
    framework: null,
    database: null,
    buildTool: null,
    architecture: null,
    branch: null,
    filesScanned: 0,
    linesOfCode: 0,
    dependencies: 0,
  };
}

function fenced(code: string): string {
  return `\`\`\`ts\n${code}\n\`\`\``;
}

function fakeCall(outputs: string[], tokens: number[] = []): BuilderModelCall {
  let index = 0;
  return async (): Promise<LLMResponse> => {
    const current = index;
    index += 1;
    const content = outputs[current];
    if (content === undefined) throw new Error('unexpected model call');
    return {
      content,
      tokensUsed: tokens[current] ?? 1,
      model: 'fake',
      provider: 'openai',
      durationMs: 0,
    };
  };
}

function refsFor(files: Record<string, string>): FileReference[] {
  return Object.entries(files).map(([filePath, content]) => ({
    pattern: `@${filePath}`,
    filePath,
    resolved: true,
    content,
  }));
}

test('updates every referenced file and sums token usage', async (t) => {
  const project = makeProject(t, 'TypeScript');
  const context = buildFileContext(
    refsFor({ 'a.ts': 'export const a = 1;\n', 'b.ts': 'export const b = 2;\n', 'c.ts': 'export const c = 3;\n' })
  );
  const builder = createBuilder(
    buildDefaultConfig('openai', 'test-key'),
    fakeCall([fenced('export const a = 10;'), fenced('export const b = 20;'), fenced('export const c = 30;')], [2, 3, 4])
  );

  const result = await builder.generate('update all three', project, 'plan', context);

  assert.equal(result.files.length, 3);
  assert.deepEqual(result.files.map((file) => file.path), ['a.ts', 'b.ts', 'c.ts']);
  assert.equal(result.tokensUsed, 9);
});

test('retries once when a response has no fenced code block', async (t) => {
  const project = makeProject(t, 'TypeScript');
  const context = buildFileContext(refsFor({ 'a.ts': 'export const a = 1;\n' }));
  const builder = createBuilder(
    buildDefaultConfig('openai', 'test-key'),
    fakeCall(['I updated the file.', fenced('export const a = 2;')], [3, 5])
  );

  const result = await builder.generate('update a', project, 'plan', context);

  assert.equal(result.files.length, 1);
  assert.equal(result.tokensUsed, 8);
});

test('fails with NO_CODE_BLOCK after one retry and returns no files', async (t) => {
  const project = makeProject(t, 'TypeScript');
  const context = buildFileContext(refsFor({ 'a.ts': 'export const a = 1;\n' }));
  const builder = createBuilder(
    buildDefaultConfig('openai', 'test-key'),
    fakeCall(['plain text', 'still plain text'], [1, 1])
  );

  await assert.rejects(
    builder.generate('update a', project, 'plan', context),
    (error: unknown) => error instanceof HageezError && error.code === 'NO_CODE_BLOCK'
  );
});

test('uses the project language extension for a new file', async (t) => {
  const project = makeProject(t, 'Python');
  const builder = createBuilder(
    buildDefaultConfig('openai', 'test-key'),
    fakeCall([fenced('print("hello")')])
  );

  const result = await builder.generate('Say Hello!', project, 'plan');

  assert.equal(result.files.length, 1);
  assert.equal(result.files[0].path, 'say_hello.py');
});

test('asks for a valid relative path when the language is unknown', async (t) => {
  const project = makeProject(t, null);
  const builder = createBuilder(
    buildDefaultConfig('openai', 'test-key'),
    fakeCall(['src/custom.xyz', fenced('content')], [2, 7])
  );

  const result = await builder.generate('add custom file', project, 'plan');

  assert.equal(result.files.length, 1);
  assert.equal(result.files[0].path, 'src/custom.xyz');
  assert.equal(result.tokensUsed, 9);
});

test('rejects an invalid inferred path', async (t) => {
  const project = makeProject(t, null);
  const builder = createBuilder(
    buildDefaultConfig('openai', 'test-key'),
    fakeCall(['../escape.ts'])
  );

  await assert.rejects(
    builder.generate('add custom file', project, 'plan'),
    (error: unknown) => error instanceof HageezError && error.code === 'INVALID_PATH'
  );
});
