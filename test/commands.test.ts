import { test } from 'node:test';
import * as assert from 'node:assert';
import { COMMANDS, filterCommands, findCommand, parseArgs } from '../src/ui/commands';

test('commands: registry contains all 13 canonical commands', () => {
  assert.strictEqual(COMMANDS.length, 13);
  const expected = [
    '/help',
    '/agents',
    '/assign',
    '/connect',
    '/models',
    '/plan',
    '/build',
    '/chat',
    '/memory',
    '/skills',
    '/diff',
    '/undo',
    '/doctor',
  ];
  for (const name of expected) {
    assert.ok(COMMANDS.some((c) => c.name === name), `Command ${name} must be registered`);
  }
});

test('commands: filterCommands filters correctly by typing /as', () => {
  const filtered = filterCommands('/as');
  assert.ok(filtered.length >= 1);
  assert.strictEqual(filtered[0].name, '/assign');

  const filteredShort = filterCommands('as');
  assert.ok(filteredShort.some((c) => c.name === '/assign'));
});

test('commands: findCommand matches exact command', () => {
  const cmd = findCommand('/diff');
  assert.ok(cmd);
  assert.strictEqual(cmd?.name, '/diff');

  const cmdWithoutSlash = findCommand('doctor');
  assert.ok(cmdWithoutSlash);
  assert.strictEqual(cmdWithoutSlash?.name, '/doctor');
});

test('commands: parseArgs parses positional and flag arguments', () => {
  const parsed = parseArgs(['add', 'groq', 'groq', '--key', 'gsk_123', '--model', 'llama-3.3-70b']);
  assert.deepStrictEqual(parsed.positional, ['add', 'groq', 'groq']);
  assert.strictEqual(parsed.options.key, 'gsk_123');
  assert.strictEqual(parsed.options.model, 'llama-3.3-70b');

  const boolParsed = parseArgs(['--preset', 'mixed']);
  assert.strictEqual(boolParsed.options.preset, 'mixed');
});
