import { test } from 'node:test';
import * as assert from 'node:assert';
import {
  createInitialUIState,
  uiStateReducer,
  UIState,
  CANONICAL_AGENTS,
} from '../src/ui/state';
import { UIEvent } from '../src/ui/events';

test('ui state reducer: handles a run matching layout image (7 done, 1 working, 1 skipped, 1 waiting)', () => {
  let state: UIState = createInitialUIState();

  // Initial state invariants
  assert.strictEqual(state.sidebar.agents.length, 10);
  assert.strictEqual(state.sidebar.agentsDoneCount, 0);
  assert.strictEqual(state.sidebar.agents.every((a) => a.status === 'waiting'), true);

  const fakeEvents: UIEvent[] = [
    {
      type: 'run:start',
      payload: {
        runId: 'run_09b4f2a',
        task: 'Build the full-screen CLI interface',
        mode: 'build',
        model: 'anthropic:claude-3-5-sonnet',
      },
    },
    // 1. analyst done (12s)
    { type: 'agent:start', payload: { id: 'analyst', agent: 'analyst', model: 'openai:gpt-4o' } },
    { type: 'agent:done', payload: { id: 'analyst', agent: 'analyst', durationMs: 12000, summary: 'Scanned repository' } },

    // 2. product-brief done (18s)
    { type: 'agent:start', payload: { id: 'product-brief', agent: 'product-brief', model: 'anthropic:claude-3-5-sonnet' } },
    { type: 'agent:done', payload: { id: 'product-brief', agent: 'product-brief', durationMs: 18000, summary: 'Product brief synthesized' } },

    // 3. pm done (41s)
    { type: 'agent:start', payload: { id: 'pm', agent: 'pm', model: 'anthropic:claude-3-5-sonnet' } },
    { type: 'agent:done', payload: { id: 'pm', agent: 'pm', durationMs: 41000, summary: 'Plan established' } },

    // 4. ux-designer done (25s)
    { type: 'agent:start', payload: { id: 'ux-designer', agent: 'ux-designer', model: 'openai:gpt-4o' } },
    { type: 'agent:done', payload: { id: 'ux-designer', agent: 'ux-designer', durationMs: 25000, summary: 'Wireframes complete' } },

    // 5. architect done (34s)
    { type: 'agent:start', payload: { id: 'architect', agent: 'architect', model: 'anthropic:claude-3-5-sonnet' } },
    { type: 'agent:done', payload: { id: 'architect', agent: 'architect', durationMs: 34000, summary: 'Architecture verified' } },

    // 6. project-context done (15s)
    { type: 'agent:start', payload: { id: 'project-context', agent: 'project-context', model: 'anthropic:claude-3-5-sonnet' } },
    { type: 'agent:done', payload: { id: 'project-context', agent: 'project-context', durationMs: 15000, summary: 'Context merged' } },

    // 7. build done (58s)
    { type: 'agent:start', payload: { id: 'build', agent: 'build', model: 'anthropic:claude-3-5-sonnet' } },
    { type: 'agent:done', payload: { id: 'build', agent: 'build', durationMs: 58000, summary: 'TUI shell generated' } },

    // 8. code-review: working
    { type: 'agent:start', payload: { id: 'code-review', agent: 'code-review', model: 'anthropic:claude-3-5-sonnet' } },

    // 9. qa-tests: skipped
    { type: 'agent:skipped', payload: { id: 'qa-tests', agent: 'qa-tests', reason: 'offline mode' } },

    // 10. retrospective remains waiting (no events emitted for it)

    // Token usage & cost
    {
      type: 'usage',
      payload: { tokens: 24180, totalTokens: 24180, cost: 0.042, contextLimit: 128000 },
    },

    // Approval request
    {
      type: 'approval:request',
      payload: {
        file: 'src/ui/layout.ts',
        diff: '+ export function renderLayoutShell(): void {}',
        backupPath: 'ai-learning/backups/layout.ts.bak',
        index: 1,
        total: 1,
      },
    },
  ];

  // Fold all events through the pure reducer
  for (const event of fakeEvents) {
    state = uiStateReducer(state, event);
  }

  // Assert exactly 7 done, 1 working, 1 skipped, 1 waiting
  const doneAgents = state.sidebar.agents.filter((a) => a.status === 'done');
  const workingAgents = state.sidebar.agents.filter((a) => a.status === 'working');
  const skippedAgents = state.sidebar.agents.filter((a) => a.status === 'skipped');
  const waitingAgents = state.sidebar.agents.filter((a) => a.status === 'waiting');

  assert.strictEqual(doneAgents.length, 7, 'Must have exactly 7 done agents');
  assert.strictEqual(workingAgents.length, 1, 'Must have exactly 1 working agent');
  assert.strictEqual(skippedAgents.length, 1, 'Must have exactly 1 skipped agent');
  assert.strictEqual(waitingAgents.length, 1, 'Must have exactly 1 waiting agent');

  // Verify done counter
  assert.strictEqual(state.sidebar.agentsDoneCount, 7);
  assert.strictEqual(state.sidebar.runId, 'run_09b4f2a');
  assert.strictEqual(state.sidebar.title, 'Build the full-screen CLI interface');

  // Verify working agent
  assert.strictEqual(workingAgents[0].agent, 'code-review');
  assert.strictEqual(workingAgents[0].model, 'anthropic:claude-3-5-sonnet');

  // Verify skipped agent
  assert.strictEqual(skippedAgents[0].agent, 'qa-tests');
  assert.strictEqual(skippedAgents[0].reason, 'offline mode');

  // Verify waiting agent
  assert.strictEqual(waitingAgents[0].agent, 'retrospective');

  // Verify token usage
  assert.strictEqual(state.sidebar.tokens, 24180);
  assert.strictEqual(state.sidebar.tokenPercent, 19);
  assert.strictEqual(state.sidebar.estimatedCost, 0.042);

  // Verify approval request state
  assert.strictEqual(state.approval.active, true);
  assert.strictEqual(state.approval.file, 'src/ui/layout.ts');

  // Verify feed blocks received
  assert.ok(state.feed.blocks.length >= 8, 'Feed should record task, start, and completed agent blocks');
  assert.strictEqual(state.feed.blocks[0].kind, 'user');
  assert.strictEqual(state.feed.blocks[0].content, 'Build the full-screen CLI interface');
});
