import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { BUILD_STEPS } from '../src/commands/build';
import { logSession } from '../src/memory';

test('the visible Build pipeline has exactly the six real steps', () => {
  assert.deepEqual(
    BUILD_STEPS.map((step) => step.label),
    [
      'Scanning project & collecting context',
      'Understanding request',
      'Creating execution plan',
      'Generating & modifying code',
      'Applying file changes',
      'Reviewing & refining',
    ]
  );
});

test('a failed Build session can record its outcome and error', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hageezai-session-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  await logSession({
    command: 'build',
    task: 'failed task',
    steps: [
      { id: 0, label: 'Scanning project & collecting context', status: 'done' },
      { id: 1, label: 'Understanding request', status: 'error' },
    ],
    tokensUsed: 3,
    durationMs: 10,
    outcome: 'failed',
    error: 'boom',
    projectPath: root,
  });

  const sessionDir = path.join(root, 'ai-learning', 'session_logs');
  const files = fs.readdirSync(sessionDir);
  assert.equal(files.length, 1);

  const sessions = JSON.parse(
    fs.readFileSync(path.join(sessionDir, files[0]), 'utf-8')
  ) as Array<{ outcome: string; error?: string }>;

  assert.equal(sessions[0].outcome, 'failed');
  assert.equal(sessions[0].error, 'boom');
});
