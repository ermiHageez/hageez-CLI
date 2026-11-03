import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { buildFileContext, parseFileReferences } from '../src/ui/filerefs';

function makeProject(t: { after: (fn: () => void) => void }): { root: string; outside: string } {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'hageezai-filerefs-'));
  const root = path.join(base, 'project');
  const outside = path.join(base, 'outside');
  fs.mkdirSync(root);
  fs.mkdirSync(outside);
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  return { root, outside };
}

test('file references only read files inside the project', (t) => {
  const { root, outside } = makeProject(t);
  fs.mkdirSync(path.join(root, 'src'));
  fs.writeFileSync(path.join(root, 'src', 'inside.ts'), 'export const inside = 1;\n');
  fs.writeFileSync(path.join(outside, 'secret.txt'), 'TOP SECRET\n');

  const refs = parseFileReferences('@../outside/secret.txt @src/inside.ts', root);
  const byPattern = Object.fromEntries(refs.map((ref) => [ref.pattern, ref]));

  assert.equal(byPattern['@../outside/secret.txt'].resolved, false);
  assert.equal(byPattern['@../outside/secret.txt'].content, undefined);
  assert.equal(byPattern['@src/inside.ts'].resolved, true);
  assert.equal(byPattern['@src/inside.ts'].content, 'export const inside = 1;\n');

  const context = buildFileContext(refs);
  assert.equal(context.includes('TOP SECRET'), false);
  assert.equal(context.includes('export const inside = 1;'), true);
});

test('file references reject protected directories and symlink escapes', (t) => {
  if (process.platform === 'win32') return t.skip('symlink creation may require privileges');
  const { root, outside } = makeProject(t);
  fs.mkdirSync(path.join(root, 'node_modules', 'pkg'), { recursive: true });
  fs.writeFileSync(path.join(root, 'node_modules', 'pkg', 'index.js'), 'module.exports = 1;\n');
  const outsideFile = path.join(outside, 'linked.ts');
  fs.writeFileSync(outsideFile, 'outside content\n');
  fs.symlinkSync(outsideFile, path.join(root, 'linked.ts'));

  const refs = parseFileReferences('@node_modules/pkg/index.js @linked.ts', root);

  assert.deepEqual(refs.map((ref) => ref.resolved), [false, false]);
  assert.deepEqual(refs.map((ref) => ref.content), [undefined, undefined]);
});
