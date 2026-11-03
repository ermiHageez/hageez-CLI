import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { validateProjectPath } from '../src/filesystem';
import { applyBuilderResult } from '../src/builder';
import { HageezError } from '../src/core/types';

function makeProject(t: { after: (fn: () => void) => void }): { root: string; outside: string } {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'hageezai-paths-'));
  const root = path.join(base, 'project');
  const outside = path.join(base, 'outside');
  fs.mkdirSync(root);
  fs.mkdirSync(outside);
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  return { root, outside };
}

function assertCode(fn: () => unknown, code: string): void {
  assert.throws(fn, (error: unknown) => error instanceof HageezError && error.code === code);
}

test('accepts relative and absolute paths inside the project', (t) => {
  const { root } = makeProject(t);

  assert.equal(
    validateProjectPath(root, 'src/inside.ts'),
    path.join(fs.realpathSync(root), 'src/inside.ts')
  );
  assert.equal(
    validateProjectPath(root, path.join(root, 'src', 'absolute.ts')),
    path.join(fs.realpathSync(root), 'src', 'absolute.ts')
  );
});

test('rejects traversal and absolute paths outside the project', (t) => {
  const { root, outside } = makeProject(t);

  assert.throws(
    () => validateProjectPath(root, '../outside.ts'),
    (error: unknown) =>
      error instanceof HageezError &&
      error.code === 'PATH_ESCAPE' &&
      error.message.includes('../outside.ts')
  );

  const outsideTarget = path.join(outside, 'escape.ts');
  assert.throws(
    () => validateProjectPath(root, outsideTarget),
    (error: unknown) =>
      error instanceof HageezError &&
      error.code === 'PATH_ESCAPE' &&
      error.message.includes(path.relative(root, outsideTarget)) &&
      !error.message.includes(outsideTarget)
  );
});

test('rejects protected path segments', (t) => {
  const { root } = makeProject(t);

  assert.throws(
    () => validateProjectPath(root, '.git/config'),
    (error: unknown) =>
      error instanceof HageezError &&
      error.code === 'PATH_FORBIDDEN' &&
      error.message.includes('.git/config')
  );
  assertCode(() => validateProjectPath(root, 'node_modules/pkg/index.js'), 'PATH_FORBIDDEN');
});

test('rejects a symlink escape when symlinks are available', (t) => {
  if (process.platform === 'win32') return t.skip('symlink creation may require privileges');
  const { root, outside } = makeProject(t);
  fs.symlinkSync(outside, path.join(root, 'link'), 'dir');

  assertCode(() => validateProjectPath(root, 'link/escape.ts'), 'PATH_ESCAPE');
});

test('rejects a broken symlink escape', (t) => {
  if (process.platform === 'win32') return t.skip('symlink creation may require privileges');
  const { root, outside } = makeProject(t);
  fs.symlinkSync(path.join(outside, 'missing.ts'), path.join(root, 'broken.ts'));

  assertCode(() => validateProjectPath(root, 'broken.ts'), 'PATH_ESCAPE');
});

test('validates every path in a batch before writing any file', (t) => {
  const { root } = makeProject(t);

  const result = applyBuilderResult(
    {
      content: '',
      tokensUsed: 0,
      files: [
        { path: 'safe.ts', action: 'create', content: 'safe' },
        { path: '../escape.ts', action: 'create', content: 'escape' },
      ],
    },
    root
  );

  assert.equal(result.written.length, 0);
  assert.ok(result.errors.some((error) => error.includes('PATH_ESCAPE')));
  assert.ok(result.errors.some((error) => error.includes('../escape.ts')));
  assert.equal(fs.existsSync(path.join(root, 'safe.ts')), false);
});

test('writes a valid file inside the project', (t) => {
  const { root } = makeProject(t);

  const result = applyBuilderResult(
    {
      content: '',
      tokensUsed: 0,
      files: [{ path: 'src/inside.ts', action: 'create', content: 'export {};\n' }],
    },
    root
  );

  assert.deepEqual(result.errors, []);
  assert.equal(fs.readFileSync(path.join(root, 'src', 'inside.ts'), 'utf-8'), 'export {};\n');
});
