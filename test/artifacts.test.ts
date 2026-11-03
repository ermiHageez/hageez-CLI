import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  createRun,
  finishRun,
  listArtifacts,
  readArtifact,
  readManifest,
  writeArtifact,
} from '../src/artifacts';
import { HageezError } from '../src/core/types';

function tempProject(t: { after: (fn: () => void) => void }): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hageezai-artifacts-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test('artifacts and the manifest record inputs, outputs, status, time, and model', (t) => {
  const project = tempProject(t);
  createRun('build a thing', project, 'run-1');
  writeArtifact('run-1', 'analyst', '# Analysis\nrequirements', {
    model: 'gpt-4o',
    connection: 'openai',
    inputs: ['task'],
  }, project);

  assert.equal(readArtifact('run-1', 'analyst', project), '# Analysis\nrequirements');
  const manifest = readManifest('run-1', project);
  assert.equal(manifest.task, 'build a thing');
  assert.equal(manifest.artifacts.length, 1);
  assert.equal(manifest.artifacts[0].agent, 'analyst');
  assert.equal(manifest.artifacts[0].status, 'success');
  assert.equal(manifest.artifacts[0].model, 'gpt-4o');
  assert.deepEqual(manifest.artifacts[0].inputs, ['task']);
  assert.ok(manifest.artifacts[0].startedAt);
  assert.ok(manifest.artifacts[0].finishedAt);

  finishRun('run-1', 'success', project);
  assert.equal(readManifest('run-1', project).status, 'success');
  assert.deepEqual(listArtifacts('run-1', project).map((item) => item.agent), ['analyst']);
});

test('a second agent can read the first artifact as upstream input', (t) => {
  const project = tempProject(t);
  createRun('task', project, 'run-2');
  writeArtifact('run-2', 'analyst', 'analysis body', {}, project);
  writeArtifact('run-2', 'pm', 'plan body', { inputs: ['analyst'] }, project);

  const upstream = readArtifact('run-2', 'analyst', project);
  assert.match(upstream, /analysis body/);
  assert.deepEqual(listArtifacts('run-2', project).map((item) => item.agent), ['analyst', 'pm']);
});

test('artifact paths are rejected before writing', (t) => {
  const project = tempProject(t);
  createRun('task', project, 'run-3');
  assert.throws(
    () => writeArtifact('run-3', '../escape', 'x', {}, project),
    (err: unknown) => err instanceof HageezError && err.code === 'ARTIFACT_PATH_INVALID'
  );
  assert.throws(
    () => writeArtifact('../run', 'analyst', 'x', {}, project),
    (err: unknown) => err instanceof HageezError && err.code === 'ARTIFACT_PATH_INVALID'
  );
});

test('a failed atomic write leaves no partial artifact', (t) => {
  const project = tempProject(t);
  createRun('task', project, 'run-4');
  const nativeFs = require('node:fs') as { renameSync: typeof fs.renameSync };
  const original = nativeFs.renameSync;
  nativeFs.renameSync = (() => { throw new Error('rename failed'); }) as typeof fs.renameSync;
  try {
    assert.throws(
      () => writeArtifact('run-4', 'analyst', 'partial', {}, project),
      (err: unknown) => err instanceof HageezError && err.code === 'ARTIFACT_WRITE_FAILED'
    );
  } finally {
    nativeFs.renameSync = original;
  }
  assert.equal(fs.existsSync(path.join(project, 'ai-learning', 'runs', 'run-4', 'analyst.md')), false);
  assert.equal(listArtifacts('run-4', project).length, 0);
});
