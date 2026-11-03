import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { runViaOpencode } from '../src/tools';
import { HageezError } from '../src/core/types';

function fakeOpencode(
  t: { after: (fn: () => void) => void },
  exitCode: number
): { dir: string; executable: string; argvFile: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hageezai-opencode-'));
  const executable = path.join(dir, 'opencode');
  const argvFile = path.join(dir, 'argv.json');
  fs.writeFileSync(
    executable,
    `#!/usr/bin/env node
const fs = require('node:fs');
fs.writeFileSync(${JSON.stringify(argvFile)}, JSON.stringify(process.argv.slice(2)));
process.exit(${exitCode});
`,
    { mode: 0o755 }
  );
  fs.chmodSync(executable, 0o755);
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return { dir, executable, argvFile };
}

test('passes the task as one argv element to opencode run', async (t) => {
  if (process.platform === 'win32') return t.skip('POSIX executable fixture');
  const { dir, executable, argvFile } = fakeOpencode(t, 0);
  const task = 'fix this; echo hacked';

  await runViaOpencode(task, { executable, cwd: dir, stdio: 'ignore' });

  const argv = JSON.parse(fs.readFileSync(argvFile, 'utf-8')) as string[];
  assert.deepEqual(argv, ['run', '--', task]);
  assert.equal(argv.length, 3);
  assert.equal(argv[2], task);
});

test('missing opencode raises OPENCODE_NOT_FOUND', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hageezai-opencode-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  await assert.rejects(
    runViaOpencode('task', {
      executable: path.join(dir, 'does-not-exist'),
      cwd: dir,
      stdio: 'ignore',
    }),
    (error: unknown) => error instanceof HageezError && error.code === 'OPENCODE_NOT_FOUND'
  );
});

test('a non-zero opencode exit raises OPENCODE_FAILED', async (t) => {
  if (process.platform === 'win32') return t.skip('POSIX executable fixture');
  const { dir, executable } = fakeOpencode(t, 7);

  await assert.rejects(
    runViaOpencode('task', { executable, cwd: dir, stdio: 'ignore' }),
    (error: unknown) => error instanceof HageezError && error.code === 'OPENCODE_FAILED'
  );
});
