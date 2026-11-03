import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { buildDefaultConfig, getDefaultModel } from '../src/core/config';
import { HageezError } from '../src/core/types';
import { scanProject } from '../src/filesystem';

const providers = ['openai', 'anthropic', 'grok', 'groq'] as const;

test('every provider has a default model', () => {
  for (const provider of providers) {
    assert.equal(typeof getDefaultModel(provider), 'string');
    assert.ok(getDefaultModel(provider).length > 0);
  }
});

test('buildDefaultConfig returns the expected defaults', () => {
  const config = buildDefaultConfig('openai', 'test-key');

  assert.deepEqual(config.defaultModel, { connection: 'openai', model: getDefaultModel('openai') });
  assert.equal(config.connections.openai.type, 'openai');
  assert.equal(config.connections.openai.apiKey, 'test-key');
  assert.equal(config.maxTokens, 8192);
  assert.equal(config.temperature, 0.2);
  assert.equal(config.memoryEnabled, true);
  assert.equal(config.ragEnabled, true);
  assert.equal(config.telemetryEnabled, false);
});

test('HageezError preserves its code, message, and cause', () => {
  const cause = new Error('underlying');
  const error = new HageezError('TEST_CODE', 'something failed', cause);

  assert.equal(error.name, 'HageezError');
  assert.equal(error.code, 'TEST_CODE');
  assert.equal(error.message, 'something failed');
  assert.equal(error.cause, cause);
});

test('scanProject detects a minimal TypeScript project', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hageezai-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({ dependencies: { react: '^18.0.0' }, devDependencies: { vite: '^5.0.0' } })
  );
  fs.writeFileSync(path.join(dir, 'index.ts'), 'const value: number = 1;\n');

  const project = await scanProject(dir);

  assert.equal(project.name, path.basename(dir));
  assert.equal(project.language, 'TypeScript');
  assert.equal(project.framework, 'React');
  assert.equal(project.buildTool, 'Vite');
  assert.equal(project.filesScanned, 1);
});
