import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { reviewAndApply } from '../src/commands/approval';
import { createFileDiff } from '../src/ui/diff';
import { HageezError } from '../src/core/types';

const nativeFs = require('node:fs') as {
  readFileSync: typeof fs.readFileSync;
};

function fixture(t: { after: (fn: () => void) => void }): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hageezai-approval-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function write(root: string, filePath: string, content: string): void {
  const target = path.join(root, filePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, 'utf-8');
}

test('--yes approves every file and backs up existing targets', async (t) => {
  const root = fixture(t);
  write(root, 'a.txt', 'old a\n');
  write(root, 'c.txt', 'old c\n');

  const result = await reviewAndApply(
    [
      { path: 'a.txt', action: 'modify', content: 'new a\n' },
      { path: 'b.txt', action: 'create', content: 'new b\n' },
      { path: 'c.txt', action: 'delete' },
    ],
    root,
    {
      yes: true,
      render: () => {},
      timestamp: new Date('2026-01-02T03:04:05.000Z'),
    }
  );

  assert.equal(result.approved.length, 3);
  assert.equal(result.errors.length, 0);
  assert.equal(fs.readFileSync(path.join(root, 'a.txt'), 'utf-8'), 'new a\n');
  assert.equal(fs.readFileSync(path.join(root, 'b.txt'), 'utf-8'), 'new b\n');
  assert.equal(fs.existsSync(path.join(root, 'c.txt')), false);

  const backupRoot = path.join(root, 'ai-learning', 'backups', '2026-01-02T03-04-05-000Z');
  assert.equal(fs.readFileSync(path.join(backupRoot, 'a.txt'), 'utf-8'), 'old a\n');
  assert.equal(fs.readFileSync(path.join(backupRoot, 'c.txt'), 'utf-8'), 'old c\n');
  assert.equal(fs.existsSync(path.join(backupRoot, 'b.txt')), false);
});

test('partial approval writes only the approved files', async (t) => {
  const root = fixture(t);
  write(root, 'a.txt', 'old a\n');
  write(root, 'b.txt', 'old b\n');
  const answers = ['y', 'n'];

  const result = await reviewAndApply(
    [
      { path: 'a.txt', action: 'modify', content: 'new a\n' },
      { path: 'b.txt', action: 'modify', content: 'new b\n' },
    ],
    root,
    { isTTY: true, ask: async () => answers.shift() ?? '', render: () => {} }
  );

  assert.deepEqual(result.approved.map((change) => change.path), ['a.txt']);
  assert.deepEqual(result.rejected.map((change) => change.path), ['b.txt']);
  assert.equal(fs.readFileSync(path.join(root, 'a.txt'), 'utf-8'), 'new a\n');
  assert.equal(fs.readFileSync(path.join(root, 'b.txt'), 'utf-8'), 'old b\n');
});

test('empty input rejects every file and writes nothing', async (t) => {
  const root = fixture(t);
  write(root, 'a.txt', 'old a\n');

  const result = await reviewAndApply(
    [{ path: 'a.txt', action: 'modify', content: 'new a\n' }],
    root,
    { isTTY: true, ask: async () => '', render: () => {} }
  );

  assert.equal(result.approved.length, 0);
  assert.equal(result.rejected.length, 1);
  assert.equal(fs.readFileSync(path.join(root, 'a.txt'), 'utf-8'), 'old a\n');
});

test('dry-run shows diffs but writes nothing and creates no ai-learning directory', async (t) => {
  const root = fixture(t);
  write(root, 'a.txt', 'old a\n');
  let prompted = false;

  const result = await reviewAndApply(
    [{ path: 'a.txt', action: 'modify', content: 'new a\n' }],
    root,
    {
      dryRun: true,
      isTTY: true,
      ask: async () => {
        prompted = true;
        return 'y';
      },
      render: () => {},
    }
  );

  assert.equal(prompted, false);
  assert.equal(result.dryRun, true);
  assert.equal(result.diffs.length, 1);
  assert.equal(fs.readFileSync(path.join(root, 'a.txt'), 'utf-8'), 'old a\n');
  assert.equal(fs.existsSync(path.join(root, 'ai-learning')), false);
});

test('a non-TTY build without --yes refuses before writing', async (t) => {
  const root = fixture(t);
  write(root, 'a.txt', 'old a\n');

  await assert.rejects(
    reviewAndApply(
      [{ path: 'a.txt', action: 'modify', content: 'new a\n' }],
      root,
      { isTTY: false, render: () => {} }
    ),
    (error: unknown) =>
      error instanceof HageezError && error.code === 'APPROVAL_REQUIRES_TTY'
  );

  assert.equal(fs.readFileSync(path.join(root, 'a.txt'), 'utf-8'), 'old a\n');
  assert.equal(fs.existsSync(path.join(root, 'ai-learning')), false);
});

test('refuses to update an existing file that cannot be read for backup', async (t) => {
  const root = fixture(t);
  write(root, 'a.txt', 'old a\n');
  const target = path.join(root, 'a.txt');
  const original = nativeFs.readFileSync;
  nativeFs.readFileSync = ((...args: Parameters<typeof fs.readFileSync>) => {
    if (String(args[0]) === target) {
      throw Object.assign(new Error('permission denied'), { code: 'EACCES' });
    }
    return original(...args);
  }) as typeof fs.readFileSync;

  try {
    await assert.rejects(
      reviewAndApply(
        [{ path: 'a.txt', action: 'modify', content: 'new a\n' }],
        root,
        { yes: true, render: () => {} }
      ),
      (error: unknown) => error instanceof HageezError && error.code === 'BACKUP_FAILED'
    );
  } finally {
    nativeFs.readFileSync = original;
  }

  assert.equal(original(target, 'utf-8'), 'old a\n');
  assert.equal(fs.existsSync(path.join(root, 'ai-learning')), false);
});

test('refuses to delete an existing file that cannot be read for backup', async (t) => {
  const root = fixture(t);
  write(root, 'a.txt', 'old a\n');
  const target = path.join(root, 'a.txt');
  const original = nativeFs.readFileSync;
  nativeFs.readFileSync = ((...args: Parameters<typeof fs.readFileSync>) => {
    if (String(args[0]) === target) {
      throw Object.assign(new Error('permission denied'), { code: 'EACCES' });
    }
    return original(...args);
  }) as typeof fs.readFileSync;

  try {
    await assert.rejects(
      reviewAndApply(
        [{ path: 'a.txt', action: 'delete' }],
        root,
        { yes: true, render: () => {} }
      ),
      (error: unknown) => error instanceof HageezError && error.code === 'BACKUP_FAILED'
    );
  } finally {
    nativeFs.readFileSync = original;
  }

  assert.equal(original(target, 'utf-8'), 'old a\n');
  assert.equal(fs.existsSync(path.join(root, 'ai-learning')), false);
});

test('large diffs are capped', () => {
  const before = Array.from({ length: 500 }, (_, index) => `old ${index}`).join('\n');
  const after = Array.from({ length: 500 }, (_, index) => `new ${index}`).join('\n');
  const diff = createFileDiff('large.txt', 'update', before, after);

  assert.equal(diff.truncated, true);
  assert.ok((diff.additions?.length ?? 0) + (diff.deletions?.length ?? 0) <= 400);
});

test('huge diffs skip the quadratic LCS matrix', () => {
  const before = Array.from({ length: 2_000 }, (_, index) => `old ${index}`).join('\n');
  const after = Array.from({ length: 2_000 }, (_, index) => `new ${index}`).join('\n');
  const diff = createFileDiff('huge.txt', 'update', before, after);

  assert.equal(diff.truncated, true);
  assert.equal(diff.deletions?.length, 200);
  assert.equal(diff.additions?.length, 200);
});

test('TUI approval modal: approves one file and rejects another', async (t) => {
  const root = fixture(t);
  write(root, 'file1.ts', 'const a = 1;\n');
  write(root, 'file2.ts', 'const b = 2;\n');

  const answers = ['y', 'n'];
  let askIdx = 0;

  const result = await reviewAndApply(
    [
      { path: 'file1.ts', action: 'modify', content: 'const a = 100;\n' },
      { path: 'file2.ts', action: 'modify', content: 'const b = 200;\n' },
    ],
    root,
    {
      isTTY: true,
      ask: async () => answers[askIdx++],
      render: () => {},
    }
  );

  assert.equal(result.approved.length, 1);
  assert.equal(result.approved[0].path, 'file1.ts');
  assert.equal(result.rejected.length, 1);
  assert.equal(result.rejected[0].path, 'file2.ts');
  assert.equal(fs.readFileSync(path.join(root, 'file1.ts'), 'utf-8'), 'const a = 100;\n');
  assert.equal(fs.readFileSync(path.join(root, 'file2.ts'), 'utf-8'), 'const b = 2;\n');
});

