import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { getStartupStatusItems } from '../src/ui/startup';
import { getVersion } from '../src/core/version';
import { VERSION } from '../src/ui/theme';
import { buildDefaultConfig } from '../src/core/config';
import type { ProjectContext } from '../src/core/types';

function tempRoot(t: { after: (fn: () => void) => void }): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hageezai-status-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

const project: ProjectContext = {
  path: '/tmp/project',
  name: 'fixture',
  language: 'TypeScript',
  framework: null,
  database: null,
  buildTool: null,
  architecture: null,
  branch: 'main',
  filesScanned: 1,
  linesOfCode: 1,
  dependencies: 0,
};

test('startup status reflects real config, git, ai-learning, and project state', (t) => {
  const root = tempRoot(t);
  fs.mkdirSync(path.join(root, '.git'));
  fs.mkdirSync(path.join(root, 'ai-learning'));

  const items = getStartupStatusItems(
    { config: buildDefaultConfig('openai', 'secret'), project },
    root
  );
  const byLabel = Object.fromEntries(items.map((item) => [item.label, item]));

  assert.equal(byLabel['Config & API key'].ok, true);
  assert.equal(byLabel['Git repository'].ok, true);
  assert.equal(byLabel['ai-learning/'].ok, true);
  assert.equal(byLabel['Project loaded'].ok, true);
});

test('startup status does not claim success for absent config, git, or project', (t) => {
  const root = tempRoot(t);
  const items = getStartupStatusItems({}, root);
  const byLabel = Object.fromEntries(items.map((item) => [item.label, item]));

  assert.equal(byLabel['Config & API key'].ok, false);
  assert.equal(byLabel['Config & API key'].detail, 'Not configured');
  assert.equal(byLabel['Git repository'].ok, false);
  assert.equal(byLabel['ai-learning/'].ok, false);
  assert.equal(byLabel['Project loaded'].ok, false);
  assert.equal(Object.entries(byLabel).find(([label]) => label.startsWith('Memory'))?.[1].ok, false);
  assert.equal(byLabel['RAG off (not implemented)'].ok, false);
});

test('VERSION and getVersion come from package metadata', () => {
  const pkg = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf-8')
  ) as { version: string };

  assert.equal(getVersion(), pkg.version);
  assert.equal(VERSION, pkg.version);
});
