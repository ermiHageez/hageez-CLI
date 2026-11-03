import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  buildMemoryContext,
  listDecisions,
  recallDecisions,
  rememberDecision,
  removeDecision,
} from '../src/memory';

function tempProject(t: { after: (fn: () => void) => void }): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hageezai-memory-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test('memory add, list, keyword recall, and remove use project Decisions', async (t) => {
  const project = tempProject(t);
  await rememberDecision('stack', 'Use TypeScript strict mode', project);
  await rememberDecision('ui', 'Keep the interface keyboard accessible', project);

  assert.equal(listDecisions(project).length, 2);
  assert.equal(recallDecisions(project, 'keyboard').length, 1);
  assert.equal(recallDecisions(project, 'keyboard')[0].key, 'ui');
  assert.match(buildMemoryContext(project, 'typescript'), /strict mode/);

  assert.equal(await removeDecision('ui', project), true);
  assert.equal(recallDecisions(project).length, 1);
  assert.equal(await removeDecision('missing', project), false);
});

test('memory debug metadata never includes unrelated file contents', async (t) => {
  const project = tempProject(t);
  fs.writeFileSync(path.join(project, 'secret.txt'), 'DO NOT LEAK');
  await rememberDecision('stack', 'Use strict mode', project);
  const decisions = recallDecisions(project);
  assert.equal(JSON.stringify(decisions).includes('DO NOT LEAK'), false);
});
