import { test } from 'node:test';
import * as assert from 'node:assert';
import {
  createInitialUIState,
  uiStateReducer,
  UIState,
} from '../src/ui/state';
import {
  renderVirtualScreen,
  virtualScreenToPlainText,
  determineBreakpoint,
  flushVirtualScreenDiff,
} from '../src/ui/layout';

function createLayoutTestState(): UIState {
  let state = createInitialUIState();
  state = uiStateReducer(state, {
    type: 'run:start',
    payload: {
      runId: 'run_09b4f2a',
      task: 'Build the full-screen CLI interface',
      mode: 'build',
      model: 'anthropic:claude-3-5-sonnet',
    },
  });

  const doneList = [
    { name: 'analyst', time: 12000 },
    { name: 'product-brief', time: 18000 },
    { name: 'pm', time: 41000 },
    { name: 'ux-designer', time: 25000 },
    { name: 'architect', time: 34000 },
    { name: 'project-context', time: 15000 },
    { name: 'build', time: 58000 },
  ];

  for (const item of doneList) {
    state = uiStateReducer(state, { type: 'agent:start', payload: { id: item.name, agent: item.name } });
    state = uiStateReducer(state, { type: 'agent:done', payload: { id: item.name, agent: item.name, durationMs: item.time } });
  }

  state = uiStateReducer(state, { type: 'agent:start', payload: { id: 'code-review', agent: 'code-review' } });
  state = uiStateReducer(state, { type: 'agent:skipped', payload: { id: 'qa-tests', agent: 'qa-tests', reason: 'offline' } });

  state = uiStateReducer(state, {
    type: 'usage',
    payload: { tokens: 24180, totalTokens: 24180, cost: 0.042 },
  });

  return state;
}

test('layout: determineBreakpoint matches columns and rows criteria', () => {
  assert.strictEqual(determineBreakpoint(120, 40), 'full');
  assert.strictEqual(determineBreakpoint(140, 50), 'full');
  assert.strictEqual(determineBreakpoint(100, 30), 'compact');
  assert.strictEqual(determineBreakpoint(119, 39), 'compact');
  assert.strictEqual(determineBreakpoint(80, 24), 'narrow');
  assert.strictEqual(determineBreakpoint(99, 40), 'narrow');
});

test('layout: snapshot test for 120x40 full desktop breakpoint', () => {
  const state = createLayoutTestState();
  const screen = renderVirtualScreen(state, 120, 40, {
    projectBranch: 'Trustworthy-foundation',
    projectName: 'hageezai-cli',
  });

  assert.strictEqual(screen.length, 40, 'Must have exactly 40 rows');
  assert.strictEqual(screen[0].length, 120, 'Must have exactly 120 columns');

  const plainText = virtualScreenToPlainText(screen);
  const lines = plainText.split('\n');
  assert.strictEqual(lines.length, 40);

  // Assert header
  assert.ok(lines[0].includes('run_09b4f2a'), 'Header contains run id');
  assert.ok(lines[0].includes('Trustworthy-foundation'), 'Header contains branch');

  // Assert feed user message
  assert.ok(plainText.includes('USER TASK: Build the full-screen CLI interface'));

  // Assert sidebar contents
  assert.ok(plainText.includes('HAGEEZ AI  v1.0.0'));
  assert.ok(plainText.includes('Agents: 7 of 10 done'));
  assert.ok(plainText.includes('analyst'));
  assert.ok(plainText.includes('code-review'));

  // Assert input and footer
  assert.ok(plainText.includes('Build mode • anthropic:claude-3-5-sonnet • HageezAI'));
  assert.ok(plainText.includes('esc interrupt  tab build/plan  @ files'));
  assert.ok(plainText.includes('Tokens: 24180 (19%)'));
});

test('layout: snapshot test for 100x30 compact breakpoint', () => {
  const state = createLayoutTestState();
  const screen = renderVirtualScreen(state, 100, 30, {
    projectBranch: 'Trustworthy-foundation',
    projectName: 'hageezai-cli',
  });

  assert.strictEqual(screen.length, 30, 'Must have exactly 30 rows');
  assert.strictEqual(screen[0].length, 100, 'Must have exactly 100 columns');

  const plainText = virtualScreenToPlainText(screen);
  const lines = plainText.split('\n');
  assert.strictEqual(lines.length, 30);

  // Assert header and sidebar
  assert.ok(lines[0].includes('run_09b4f2a'));
  assert.ok(plainText.includes('HAGEEZ AI'));
  assert.ok(plainText.includes('Agents: 7 of 10 done'));
  assert.ok(plainText.includes('[ANA]'));
});

test('layout: flushVirtualScreenDiff produces incremental diffs', () => {
  const screenA = renderVirtualScreen(createInitialUIState(), 80, 24);
  const diffA = flushVirtualScreenDiff(null, screenA);
  assert.ok(diffA.length > 0, 'Initial diff flushes whole screen');

  // Second flush of identical screen produces empty diff (no flicker)
  const diffSame = flushVirtualScreenDiff(screenA, screenA);
  assert.strictEqual(diffSame, '', 'No changed cells must produce 0 ANSI bytes');
});
