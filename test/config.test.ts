import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  buildDefaultConfig,
  CONFIG_BACKUP_NAME,
  getConfigDir,
  getConfigFile,
  loadConfig,
  saveConfig,
} from '../src/core/config';
import { resolveModelConfig } from '../src/core/llm/registry';
import { HageezConfigV2, HageezError } from '../src/core/types';

const ENV_KEYS = [
  'HOME',
  'USERPROFILE',
  'HAGEEZ_API_KEY',
  'HAGEEZ_PROVIDER',
  'HAGEEZ_MODEL',
  'GROQ_API_KEY',
] as const;

const nativeFs = require('node:fs') as {
  chmodSync: typeof fs.chmodSync;
  readFileSync: typeof fs.readFileSync;
  writeFileSync: typeof fs.writeFileSync;
};

function setEnv(key: string, value: string | undefined): void {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

function setupHome(t: { after: (fn: () => void) => void }): string {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'hageezai-home-'));
  const previous = new Map<string, string | undefined>();
  for (const key of ENV_KEYS) {
    previous.set(key, process.env[key]);
    if (key.startsWith('HAGEEZ_')) setEnv(key, undefined);
  }
  process.env.HOME = home;
  process.env.USERPROFILE = home;

  t.after(() => {
    for (const key of ENV_KEYS) setEnv(key, previous.get(key));
    fs.rmSync(home, { recursive: true, force: true });
  });

  return home;
}

function v1Config(provider = 'openai', apiKey = 'file-key') {
  return {
    provider,
    apiKey,
    model: 'gpt-4o',
    maxTokens: 8192,
    temperature: 0.2,
    memoryEnabled: true,
    ragEnabled: true,
    telemetryEnabled: false,
    timeoutMs: 60000,
  };
}

function writeConfigFile(home: string, config: unknown = buildDefaultConfig('openai', 'file-key')): string {
  const dir = path.join(home, '.hageezai');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'config.json');
  fs.writeFileSync(file, JSON.stringify(config, null, 2), 'utf-8');
  return file;
}

function modeOf(target: string): number {
  return fs.statSync(target).mode & 0o777;
}

function v2Config(overrides: Partial<HageezConfigV2> = {}): HageezConfigV2 {
  return {
    version: 2,
    connections: { groq: { type: 'groq', apiKey: 'file-key' } },
    defaultModel: { connection: 'groq', model: 'llama-3.3-70b-versatile' },
    agents: {},
    maxTokens: 8192,
    temperature: 0.2,
    memoryEnabled: true,
    ragEnabled: true,
    telemetryEnabled: false,
    ...overrides,
  };
}

test('saveConfig creates a 0700 directory and a 0600 file', (t) => {
  if (process.platform === 'win32') return t.skip('POSIX modes only');
  setupHome(t);

  saveConfig(buildDefaultConfig('openai', 'file-key'));

  assert.equal(modeOf(getConfigDir()), 0o700);
  assert.equal(modeOf(getConfigFile()), 0o600);
});

test('loadConfig repairs loose existing permissions', (t) => {
  if (process.platform === 'win32') return t.skip('POSIX modes only');
  const home = setupHome(t);
  const file = writeConfigFile(home);
  const dir = path.dirname(file);
  fs.chmodSync(dir, 0o755);
  fs.chmodSync(file, 0o644);

  loadConfig();

  assert.equal(modeOf(dir), 0o700);
  assert.equal(modeOf(file), 0o600);
});

test('loadConfig fails with CONFIG_PERMISSION_ERROR when chmod fails', (t) => {
  const home = setupHome(t);
  writeConfigFile(home);
  const original = nativeFs.chmodSync;
  nativeFs.chmodSync = (() => {
    throw new Error('chmod denied');
  }) as typeof fs.chmodSync;

  try {
    assert.throws(
      () => loadConfig(),
      (error: unknown) => error instanceof HageezError && error.code === 'CONFIG_PERMISSION_ERROR'
    );
  } finally {
    nativeFs.chmodSync = original;
  }
});

test('loadConfig distinguishes read and parse failures', (t) => {
  const home = setupHome(t);
  const file = writeConfigFile(home);
  const original = nativeFs.readFileSync;
  nativeFs.readFileSync = ((...args: Parameters<typeof fs.readFileSync>) => {
    if (String(args[0]) === file) throw new Error('read denied');
    return original(...args);
  }) as typeof fs.readFileSync;

  try {
    assert.throws(
      () => loadConfig(),
      (error: unknown) => error instanceof HageezError && error.code === 'CONFIG_READ_ERROR'
    );
  } finally {
    nativeFs.readFileSync = original;
  }

  fs.writeFileSync(file, '{', 'utf-8');
  assert.throws(
    () => loadConfig(),
    (error: unknown) => error instanceof HageezError && error.code === 'CONFIG_PARSE_ERROR'
  );
});

test('saveConfig wraps write failures', (t) => {
  setupHome(t);
  const original = nativeFs.writeFileSync;
  nativeFs.writeFileSync = (() => {
    throw new Error('disk full');
  }) as typeof fs.writeFileSync;

  try {
    assert.throws(
      () => saveConfig(buildDefaultConfig('openai', 'file-key')),
      (error: unknown) => error instanceof HageezError && error.code === 'CONFIG_WRITE_ERROR'
    );
  } finally {
    nativeFs.writeFileSync = original;
  }
});

test('environment overrides win over the file and are not written back', (t) => {
  const home = setupHome(t);
  const file = writeConfigFile(home);
  process.env.HAGEEZ_API_KEY = 'env-key';
  process.env.HAGEEZ_PROVIDER = 'groq';
  process.env.HAGEEZ_MODEL = 'env-model';

  const config = loadConfig();
  const resolved = resolveModelConfig(config);

  assert.equal(resolved.apiKey, 'env-key');
  assert.equal(resolved.provider, 'groq');
  assert.equal(resolved.model, 'env-model');

  const stored = JSON.parse(fs.readFileSync(file, 'utf-8')) as {
    version?: number;
    apiKey?: string;
    provider?: string;
    connections?: Record<string, { apiKey?: string }>;
    defaultModel?: { connection?: string; model?: string };
  };
  assert.equal(stored.version, 2);
  assert.equal(stored.apiKey, undefined);
  assert.equal(stored.provider, undefined);
  assert.equal(stored.connections?.openai.apiKey, 'file-key');
  assert.equal(stored.defaultModel?.connection, 'openai');
  assert.equal(stored.defaultModel?.model, 'gpt-4o');
});

test('loadConfig migrates v1 to v2 and keeps a protected backup', (t) => {
  const home = setupHome(t);
  const file = writeConfigFile(home, { ...v1Config('groq', 'file-key'), model: 'llama-3.3-70b-versatile' });
  const original = fs.readFileSync(file, 'utf-8');

  const config = loadConfig();

  assert.equal(config.version, 2);
  const resolved = resolveModelConfig(config);
  assert.equal(resolved.provider, 'groq');
  assert.equal(resolved.model, 'llama-3.3-70b-versatile');
  assert.equal(resolved.apiKey, 'file-key');
  assert.deepEqual(config.connections, {
    groq: { type: 'groq', apiKey: 'file-key' },
  });
  assert.deepEqual(config.defaultModel, {
    connection: 'groq',
    model: 'llama-3.3-70b-versatile',
  });
  assert.deepEqual(config.agents, {});

  const stored = JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<string, unknown>;
  assert.equal(stored.version, 2);
  assert.equal(stored.provider, undefined);
  assert.equal(stored.apiKey, undefined);

  const backup = path.join(getConfigDir(), CONFIG_BACKUP_NAME);
  assert.equal(fs.readFileSync(backup, 'utf-8'), original);
  if (process.platform !== 'win32') {
    assert.equal(modeOf(backup), 0o600);
    assert.equal(modeOf(getConfigDir()), 0o700);
  }
});

test('v2 connections support env keys, ollama, openai-compatible, and agents', (t) => {
  const home = setupHome(t);
  writeConfigFile(
    home,
    v2Config({
      connections: {
        groq: { type: 'groq', apiKeyEnv: 'GROQ_API_KEY' },
        local: {
          type: 'ollama',
          baseUrl: 'http://localhost:11434',
          maxConcurrent: 1,
        },
        custom: {
          type: 'openai-compatible',
          baseUrl: 'https://example.test/v1',
          apiKey: 'inline-key',
        },
      },
      agents: {
        reviewer: { connection: 'groq', model: 'llama-3.3-70b-versatile' },
      },
    })
  );
  process.env.GROQ_API_KEY = 'env-secret';

  const config = loadConfig();

  const resolved = resolveModelConfig(config);
  assert.equal(resolved.apiKey, 'env-secret');
  assert.equal(resolved.provider, 'groq');
  assert.equal(config.connections.local.type, 'ollama');
  assert.equal(config.connections.local.baseUrl, 'http://localhost:11434');
  assert.equal(config.connections.custom.baseUrl, 'https://example.test/v1');
  assert.equal(config.connections.custom.apiKey, 'inline-key');
  assert.deepEqual(config.agents, {
    reviewer: { connection: 'groq', model: 'llama-3.3-70b-versatile' },
  });

  const stored = fs.readFileSync(getConfigFile(), 'utf-8');
  assert.equal(stored.includes('env-secret'), false);
  assert.equal(stored.includes('GROQ_API_KEY'), true);
});

test('a v2 local default needs no API key', (t) => {
  const home = setupHome(t);
  writeConfigFile(
    home,
    v2Config({
      connections: { local: { type: 'ollama' } },
      defaultModel: { connection: 'local', model: 'llama3.2:3b' },
    })
  );

  const config = loadConfig();
  const resolved = resolveModelConfig(config);

  assert.equal(resolved.provider, 'ollama');
  assert.equal(resolved.apiKey, '');
  assert.equal(resolved.model, 'llama3.2:3b');
});

test('saveConfig writes only the v2 shape', (t) => {
  const home = setupHome(t);
  saveConfig(v2Config());

  const stored = JSON.parse(fs.readFileSync(getConfigFile(), 'utf-8')) as Record<string, unknown>;
  assert.equal(stored.version, 2);
  assert.equal(stored.provider, undefined);
  assert.equal(stored.apiKey, undefined);
  assert.deepEqual(stored.connections, {
    groq: { type: 'groq', apiKey: 'file-key' },
  });

  const loaded = resolveModelConfig(loadConfig());
  assert.equal(loaded.provider, 'groq');
  assert.equal(loaded.model, 'llama-3.3-70b-versatile');
  assert.equal(loaded.apiKey, 'file-key');
});

test('empty environment values are ignored', (t) => {
  const home = setupHome(t);
  writeConfigFile(home);
  process.env.HAGEEZ_API_KEY = '   ';
  process.env.HAGEEZ_PROVIDER = '';
  process.env.HAGEEZ_MODEL = '\t';

  const config = resolveModelConfig(loadConfig());

  assert.equal(config.apiKey, 'file-key');
  assert.equal(config.provider, 'openai');
  assert.equal(config.model, 'gpt-4o');
});

test('an unsupported environment provider is rejected', (t) => {
  const home = setupHome(t);
  const file = writeConfigFile(home, v1Config());
  process.env.HAGEEZ_PROVIDER = 'invalid';

  assert.throws(
    () => loadConfig(),
    (error: unknown) => error instanceof HageezError && error.code === 'CONFIG_INVALID_PROVIDER'
  );

  const stored = JSON.parse(fs.readFileSync(file, 'utf-8')) as { version?: number };
  assert.equal(stored.version, undefined);
  assert.equal(fs.existsSync(path.join(getConfigDir(), CONFIG_BACKUP_NAME)), false);
});

test('an unsupported file provider is rejected', (t) => {
  const home = setupHome(t);
  writeConfigFile(home, v1Config('invalid'));

  assert.throws(
    () => loadConfig(),
    (error: unknown) => error instanceof HageezError && error.code === 'CONFIG_INVALID_PROVIDER'
  );
});
