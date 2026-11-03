import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as http from 'node:http';
import { AddressInfo } from 'node:net';
import { buildDefaultConfig, loadConfig, saveConfig } from '../src/core/config';
import {
  runConnectAdd,
  runConnectList,
  runConnectRemove,
  runConnectTest,
  runConnectUse,
} from '../src/commands/connect';
import { HageezError } from '../src/core/types';

function setupHome(t: { after: (fn: () => void) => void }): string {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'hageezai-connect-'));
  const previousHome = process.env.HOME;
  const previousProfile = process.env.USERPROFILE;
  process.env.HOME = home;
  process.env.USERPROFILE = home;
  t.after(() => {
    if (previousHome === undefined) delete process.env.HOME;
    else process.env.HOME = previousHome;
    if (previousProfile === undefined) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = previousProfile;
    fs.rmSync(home, { recursive: true, force: true });
  });
  return home;
}

function seed(): void {
  saveConfig(buildDefaultConfig('openai', 'sk-secret'));
}

test('connect add, use, list, and remove operate on named connections without printing keys', (t) => {
  setupHome(t);
  seed();
  runConnectAdd('compat', 'openai-compatible', {
    keyEnv: 'COMPAT_KEY',
    baseUrl: 'https://example.test/v1',
    maxConcurrent: '4',
  });

  let config = loadConfig();
  assert.deepEqual(config.connections.compat, {
    type: 'openai-compatible',
    apiKeyEnv: 'COMPAT_KEY',
    baseUrl: 'https://example.test/v1',
    maxConcurrent: 4,
  });

  runConnectUse('compat', 'custom-model');
  config = loadConfig();
  assert.deepEqual(config.defaultModel, { connection: 'compat', model: 'custom-model' });

  const output: string[] = [];
  const original = console.log;
  console.log = (...args: unknown[]) => output.push(args.join(' '));
  try {
    runConnectList();
  } finally {
    console.log = original;
  }
  assert.match(output.join('\n'), /compat/);
  assert.equal(output.join('\n').includes('sk-secret'), false);

  assert.throws(
    () => runConnectRemove('compat'),
    (err: unknown) => err instanceof HageezError && err.code === 'CONNECTION_IN_USE'
  );

  runConnectUse('openai', 'gpt-4o');
  runConnectRemove('compat');
  assert.equal(loadConfig().connections.compat, undefined);
});

test('connect test lists live cloud models through the configured base URL', async (t) => {
  setupHome(t);
  seed();
  const server = http.createServer((req, res) => {
    assert.equal(req.url, '/v1/models');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ data: [{ id: 'alpha' }, { id: 'beta' }] }));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const port = (server.address() as AddressInfo).port;
  runConnectAdd('compat', 'openai-compatible', {
    keyEnv: 'COMPAT_KEY',
    baseUrl: `http://127.0.0.1:${port}/v1`,
  });

  const output: string[] = [];
  const original = console.log;
  console.log = (...args: unknown[]) => output.push(args.join(' '));
  try {
    const ok = await runConnectTest('compat');
    assert.equal(ok, true);
  } finally {
    console.log = original;
  }
  assert.match(output.join('\n'), /2 model\(s\) available/);
});
